import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Board, Prisma, Project, TaskPriority } from "@devsync/db";
import { PrismaService } from "../prisma/prisma.service";
import { clampLimit, decodeCursor, encodeCursor } from "../common/pagination/cursor";
import { RealtimeService } from "../realtime/realtime.service";
import { RealtimeEvent } from "../realtime/realtime.events";
import { CacheService } from "../cache/cache.service";
import { workspaceCacheKeys } from "../cache/cache.keys";
import { JobsService } from "../jobs/jobs.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { ActivityQueryDto } from "./dto/activity-query.dto";
import { ListTasksQueryDto } from "./dto/list-tasks-query.dto";

type BoardWithProject = Board & { project: Project };
type TaskWithProjectAndColumn = Prisma.TaskGetPayload<{
  include: { project: true; column: { include: { board: true } } };
}>;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly cache: CacheService,
    private readonly jobs: JobsService
  ) {}

  async create(board: BoardWithProject, actorId: string, dto: CreateTaskDto) {
    const assigneeIds = this.uniqueIds(dto.assigneeIds ?? []);

    const created = await this.prisma.$transaction(async (tx) => {
      const column = await this.resolveTargetColumn(tx, board.id, dto.columnId);
      await this.assertWorkspaceMembers(tx, board.project.workspaceId, assigneeIds);

      const task = await tx.task.create({
        data: {
          projectId: board.projectId,
          columnId: column.id,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          priority: dto.priority ?? TaskPriority.MEDIUM,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
          createdById: actorId,
          position: await this.nextPositionAtEnd(tx, column.id)
        }
      });

      if (assigneeIds.length) {
        await tx.taskAssignee.createMany({
          data: assigneeIds.map((userId) => ({ taskId: task.id, userId }))
        });
      }

      await this.recordActivity(tx, {
        workspaceId: board.project.workspaceId,
        projectId: board.projectId,
        taskId: task.id,
        actorId,
        action: "task.created",
        metadata: { title: task.title, columnId: column.id }
      });

      return tx.task.findUniqueOrThrow({
        where: { id: task.id },
        include: {
          assignees: {
            include: { user: { select: { id: true, email: true, name: true } } }
          }
        }
      });
    });

    this.realtime.emitToProject(board.projectId, RealtimeEvent.TaskCreated, created);
    await this.cache.del(...workspaceCacheKeys(board.project.workspaceId));
    await this.notifyAssignees(assigneeIds, actorId, {
      type: "task.assigned",
      taskId: created.id,
      title: created.title,
      projectId: board.projectId
    });

    return created;
  }

  async update(task: TaskWithProjectAndColumn, actorId: string, dto: UpdateTaskDto) {
    let added: string[] = [];
    let moved = false;

    const result = await this.prisma.$transaction(async (tx) => {
      const targetColumnId = dto.columnId ?? task.columnId;
      await this.assertColumnBelongsToBoard(tx, targetColumnId, task.column.boardId);

      const isMove = targetColumnId !== task.columnId || dto.position !== undefined;
      moved = isMove;
      const nextPosition = isMove
        ? await this.positionForIndex(tx, targetColumnId, dto.position, task.id)
        : task.position;

      const changed = this.changedFields(task, dto);
      const updated = await tx.task.update({
        where: { id: task.id },
        data: {
          title: dto.title === undefined ? undefined : dto.title.trim(),
          description:
            dto.description === undefined ? undefined : dto.description.trim() || null,
          priority: dto.priority,
          dueAt: dto.dueAt === undefined ? undefined : new Date(dto.dueAt),
          columnId: targetColumnId,
          position: nextPosition
        }
      });

      if (Object.keys(changed).length) {
        await this.recordActivity(tx, {
          workspaceId: task.project.workspaceId,
          projectId: task.projectId,
          taskId: task.id,
          actorId,
          action: "task.updated",
          metadata: { changed }
        });
      }

      if (isMove) {
        await this.recordActivity(tx, {
          workspaceId: task.project.workspaceId,
          projectId: task.projectId,
          taskId: task.id,
          actorId,
          action: "task.moved",
          metadata: { fromColumnId: task.columnId, toColumnId: targetColumnId }
        });
      }

      if (dto.assigneeIds !== undefined) {
        const nextAssigneeIds = this.uniqueIds(dto.assigneeIds);
        await this.assertWorkspaceMembers(tx, task.project.workspaceId, nextAssigneeIds);

        const previous = await tx.taskAssignee.findMany({
          where: { taskId: task.id },
          select: { userId: true }
        });
        const previousIds = previous.map((assignee) => assignee.userId);

        await tx.taskAssignee.deleteMany({ where: { taskId: task.id } });
        if (nextAssigneeIds.length) {
          await tx.taskAssignee.createMany({
            data: nextAssigneeIds.map((userId) => ({ taskId: task.id, userId }))
          });
        }

        added = nextAssigneeIds.filter((id) => !previousIds.includes(id));

        await this.recordActivity(tx, {
          workspaceId: task.project.workspaceId,
          projectId: task.projectId,
          taskId: task.id,
          actorId,
          action: "task.assignees_changed",
          metadata: {
            added,
            removed: previousIds.filter((id) => !nextAssigneeIds.includes(id))
          }
        });
      }

      return tx.task.findUniqueOrThrow({
        where: { id: updated.id },
        include: {
          assignees: {
            include: { user: { select: { id: true, email: true, name: true } } }
          }
        }
      });
    });

    this.realtime.emitToProject(
      task.projectId,
      moved ? RealtimeEvent.TaskMoved : RealtimeEvent.TaskUpdated,
      result
    );
    await this.cache.del(...workspaceCacheKeys(task.project.workspaceId));
    await this.notifyAssignees(added, actorId, {
      type: "task.assigned",
      taskId: task.id,
      title: result.title,
      projectId: task.projectId
    });

    return result;
  }

  async delete(task: TaskWithProjectAndColumn, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.task.delete({ where: { id: task.id } });
      await this.recordActivity(tx, {
        workspaceId: task.project.workspaceId,
        projectId: task.projectId,
        actorId,
        action: "task.deleted",
        metadata: { taskId: task.id, title: task.title, columnId: task.columnId }
      });
    });

    this.realtime.emitToProject(task.projectId, RealtimeEvent.TaskDeleted, {
      id: task.id,
      columnId: task.columnId
    });
    await this.cache.del(...workspaceCacheKeys(task.project.workspaceId));

    return { success: true };
  }

  getDetail(taskId: string) {
    return this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: {
        column: { select: { id: true, name: true, boardId: true } },
        assignees: {
          include: { user: { select: { id: true, email: true, name: true } } }
        },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, email: true, name: true } } }
        }
      }
    });
  }

  async createComment(task: TaskWithProjectAndColumn, actorId: string, dto: CreateCommentDto) {
    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.taskComment.create({
        data: {
          taskId: task.id,
          authorId: actorId,
          body: dto.body.trim()
        },
        include: { author: { select: { id: true, email: true, name: true } } }
      });

      await this.recordActivity(tx, {
        workspaceId: task.project.workspaceId,
        projectId: task.projectId,
        taskId: task.id,
        actorId,
        action: "comment.created",
        metadata: { commentId: created.id }
      });

      return created;
    });

    this.realtime.emitToProject(task.projectId, RealtimeEvent.CommentCreated, {
      taskId: task.id,
      comment
    });
    await this.cache.del(...workspaceCacheKeys(task.project.workspaceId));

    return comment;
  }

  async listActivity(task: TaskWithProjectAndColumn, query: ActivityQueryDto) {
    const limit = clampLimit(query.limit);
    const where: Prisma.ActivityLogWhereInput = { taskId: task.id };

    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      const createdAt = new Date(cursor.value);
      where.OR = [
        { createdAt: { lt: createdAt } },
        { createdAt, id: { lt: cursor.id } }
      ];
    }

    const rows = await this.prisma.activityLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1
    });

    const items = rows.slice(0, limit);
    const last = items.at(-1);

    return {
      items,
      nextCursor:
        rows.length > limit && last
          ? encodeCursor({ value: last.createdAt.toISOString(), id: last.id })
          : null
    };
  }

  async listProjectTasks(project: Project, query: ListTasksQueryDto) {
    const limit = clampLimit(query.limit);
    const sort = query.sort ?? "-createdAt";
    const descending = sort.startsWith("-");
    const field = sort.replace("-", "") as "createdAt" | "dueAt";

    const where: Prisma.TaskWhereInput = {
      projectId: project.id,
      ...(query.columnId ? { columnId: query.columnId } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.q
        ? { title: { contains: query.q, mode: Prisma.QueryMode.insensitive } }
        : {}),
      ...(query.assigneeId
        ? { assignees: { some: { userId: query.assigneeId } } }
        : {})
    };

    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      const value = new Date(cursor.value);
      const op = descending ? "lt" : "gt";
      where.OR = [
        { [field]: { [op]: value } },
        { [field]: value, id: { [op]: cursor.id } }
      ];
    }

    const rows = await this.prisma.task.findMany({
      where,
      orderBy: [{ [field]: descending ? "desc" : "asc" }, { id: descending ? "desc" : "asc" }],
      take: limit + 1,
      include: {
        assignees: {
          include: { user: { select: { id: true, email: true, name: true } } }
        }
      }
    });

    const items = rows.slice(0, limit);
    const last = items.at(-1);
    const cursorValue = last?.[field];

    return {
      items,
      nextCursor:
        rows.length > limit && last && cursorValue instanceof Date
          ? encodeCursor({ value: cursorValue.toISOString(), id: last.id })
          : null
    };
  }

  private async resolveTargetColumn(
    tx: Prisma.TransactionClient,
    boardId: string,
    columnId?: string
  ) {
    if (columnId) {
      return this.assertColumnBelongsToBoard(tx, columnId, boardId);
    }

    const column = await tx.boardColumn.findFirst({
      where: { boardId },
      orderBy: { position: "asc" }
    });

    if (!column) {
      throw new NotFoundException("Board column not found");
    }

    return column;
  }

  private async assertColumnBelongsToBoard(
    tx: Prisma.TransactionClient,
    columnId: string,
    boardId: string
  ) {
    const column = await tx.boardColumn.findUnique({ where: { id: columnId } });

    if (!column || column.boardId !== boardId) {
      throw new BadRequestException("Column does not belong to this board");
    }

    return column;
  }

  private async assertWorkspaceMembers(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    userIds: string[]
  ) {
    if (!userIds.length) {
      return;
    }

    const count = await tx.workspaceMember.count({
      where: { workspaceId, userId: { in: userIds } }
    });

    if (count !== userIds.length) {
      throw new BadRequestException("Assignees must be workspace members");
    }
  }

  private async nextPositionAtEnd(tx: Prisma.TransactionClient, columnId: string) {
    const aggregate = await tx.task.aggregate({
      where: { columnId },
      _max: { position: true }
    });

    return (aggregate._max.position ?? 0) + 1000;
  }

  private async positionForIndex(
    tx: Prisma.TransactionClient,
    columnId: string,
    requestedIndex?: number,
    excludeTaskId?: string
  ) {
    if (requestedIndex === undefined) {
      return this.nextPositionAtEnd(tx, columnId);
    }

    const tasks = await tx.task.findMany({
      where: {
        columnId,
        ...(excludeTaskId ? { id: { not: excludeTaskId } } : {})
      },
      orderBy: { position: "asc" },
      select: { id: true, position: true }
    });

    if (!tasks.length) {
      return 1000;
    }

    if (requestedIndex <= 0) {
      if (tasks[0].position > 1000) {
        return tasks[0].position - 1000;
      }

      await this.rebalanceColumn(tx, columnId, excludeTaskId);
      return 500;
    }

    if (requestedIndex >= tasks.length) {
      return tasks[tasks.length - 1].position + 1000;
    }

    const previous = tasks[requestedIndex - 1];
    const next = tasks[requestedIndex];
    const gap = next.position - previous.position;

    if (gap > 1) {
      return Math.floor((previous.position + next.position) / 2);
    }

    await this.rebalanceColumn(tx, columnId, excludeTaskId);
    return requestedIndex * 1000 + 500;
  }

  private async rebalanceColumn(
    tx: Prisma.TransactionClient,
    columnId: string,
    excludeTaskId?: string
  ) {
    const tasks = await tx.task.findMany({
      where: {
        columnId,
        ...(excludeTaskId ? { id: { not: excludeTaskId } } : {})
      },
      orderBy: { position: "asc" },
      select: { id: true }
    });

    await Promise.all(
      tasks.map((task, index) =>
        tx.task.update({
          where: { id: task.id },
          data: { position: (index + 1) * 1000 }
        })
      )
    );
  }

  private recordActivity(
    tx: Prisma.TransactionClient,
    input: {
      workspaceId: string;
      actorId: string;
      action: string;
      projectId?: string;
      taskId?: string;
      metadata?: Prisma.InputJsonValue;
    }
  ) {
    return tx.activityLog.create({ data: input });
  }

  private uniqueIds(ids: string[]) {
    return [...new Set(ids)];
  }

  /** Push a transient realtime notification to each newly-assigned user (not the actor). */
  private async notifyAssignees(
    assigneeIds: string[],
    actorId: string,
    payload: { type: string; taskId: string; title: string; projectId: string }
  ) {
    for (const userId of assigneeIds) {
      if (userId !== actorId) {
        this.realtime.emitToUser(userId, RealtimeEvent.NotificationNew, payload);
        await this.jobs.enqueueNotification({ ...payload, userId });
      }
    }
  }

  private changedFields(task: TaskWithProjectAndColumn, dto: UpdateTaskDto) {
    const changed: Record<string, Prisma.InputJsonValue> = {};

    if (dto.title !== undefined && dto.title.trim() !== task.title) {
      changed.title = [task.title, dto.title.trim()];
    }

    if (dto.description !== undefined && (dto.description.trim() || null) !== task.description) {
      changed.description = [task.description, dto.description.trim() || null];
    }

    if (dto.priority !== undefined && dto.priority !== task.priority) {
      changed.priority = [task.priority, dto.priority];
    }

    if (dto.dueAt !== undefined) {
      const next = new Date(dto.dueAt);
      if (task.dueAt?.getTime() !== next.getTime()) {
        changed.dueAt = [task.dueAt?.toISOString() ?? null, next.toISOString()];
      }
    }

    return changed as Prisma.InputJsonObject;
  }
}

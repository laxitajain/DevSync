import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Role, WorkspaceMember } from "@devsync/db";
import { hasAtLeast } from "../common/rbac/roles";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireMembership(userId: string, workspaceId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } }
    });

    if (!membership) {
      throw new NotFoundException("Workspace not found");
    }

    return membership;
  }

  async requireProject(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    const membership = await this.requireMembership(userId, project.workspaceId);
    return { membership, project };
  }

  async requireBoard(userId: string, boardId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: { project: true }
    });

    if (!board) {
      throw new NotFoundException("Board not found");
    }

    const membership = await this.requireMembership(userId, board.project.workspaceId);
    return { membership, board };
  }

  async requireTask(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true, column: { include: { board: true } } }
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    const membership = await this.requireMembership(userId, task.project.workspaceId);
    return { membership, task };
  }

  async requireAttachment(userId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { task: { include: { project: true } } }
    });

    if (!attachment) {
      throw new NotFoundException("Attachment not found");
    }

    const membership = await this.requireMembership(
      userId,
      attachment.task.project.workspaceId
    );
    return { membership, attachment };
  }

  assertCanWrite(membership: WorkspaceMember) {
    if (!hasAtLeast(membership.role, Role.MEMBER)) {
      throw new ForbiddenException("Insufficient workspace role");
    }
  }
}

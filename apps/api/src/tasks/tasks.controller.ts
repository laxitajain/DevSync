import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, CurrentUserPayload } from "../common/decorators/current-user.decorator";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";
import { ActivityQueryDto } from "./dto/activity-query.dto";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { TasksService } from "./tasks.service";

@UseGuards(JwtAuthGuard)
@Controller("tasks")
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly workspaceAccess: WorkspaceAccessService
  ) {}

  @Get(":taskId")
  async get(@Param("taskId") taskId: string, @CurrentUser() user: CurrentUserPayload) {
    await this.workspaceAccess.requireTask(user.sub, taskId);
    return this.tasksService.getDetail(taskId);
  }

  @HttpCode(HttpStatus.OK)
  @Patch(":taskId")
  async update(
    @Param("taskId") taskId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateTaskDto
  ) {
    const { membership, task } = await this.workspaceAccess.requireTask(user.sub, taskId);
    this.workspaceAccess.assertCanWrite(membership);
    return this.tasksService.update(task, user.sub, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Delete(":taskId")
  async delete(@Param("taskId") taskId: string, @CurrentUser() user: CurrentUserPayload) {
    const { membership, task } = await this.workspaceAccess.requireTask(user.sub, taskId);
    this.workspaceAccess.assertCanWrite(membership);
    return this.tasksService.delete(task, user.sub);
  }

  @Post(":taskId/comments")
  async createComment(
    @Param("taskId") taskId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateCommentDto
  ) {
    const { membership, task } = await this.workspaceAccess.requireTask(user.sub, taskId);
    this.workspaceAccess.assertCanWrite(membership);
    return this.tasksService.createComment(task, user.sub, dto);
  }

  @Get(":taskId/activity")
  async listActivity(
    @Param("taskId") taskId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ActivityQueryDto
  ) {
    const { task } = await this.workspaceAccess.requireTask(user.sub, taskId);
    return this.tasksService.listActivity(task, query);
  }
}

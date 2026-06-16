import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, CurrentUserPayload } from "../common/decorators/current-user.decorator";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";
import { CreateTaskDto } from "../tasks/dto/create-task.dto";
import { TasksService } from "../tasks/tasks.service";
import { BoardsService } from "./boards.service";

@UseGuards(JwtAuthGuard)
@Controller("boards")
export class BoardsController {
  constructor(
    private readonly boardsService: BoardsService,
    private readonly tasksService: TasksService,
    private readonly workspaceAccess: WorkspaceAccessService
  ) {}

  @Get(":boardId")
  async get(@Param("boardId") boardId: string, @CurrentUser() user: CurrentUserPayload) {
    await this.workspaceAccess.requireBoard(user.sub, boardId);
    return this.boardsService.getById(boardId);
  }

  @Post(":boardId/tasks")
  async createTask(
    @Param("boardId") boardId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateTaskDto
  ) {
    const { membership, board } = await this.workspaceAccess.requireBoard(user.sub, boardId);
    this.workspaceAccess.assertCanWrite(membership);
    return this.tasksService.create(board, user.sub, dto);
  }
}

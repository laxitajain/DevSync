import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { Role, WorkspaceMember } from "@devsync/db";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, CurrentUserPayload } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentMembership } from "../workspaces/decorators/current-membership.decorator";
import { WorkspaceRolesGuard } from "../workspaces/guards/workspace-roles.guard";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";
import { CreateBoardDto } from "../boards/dto/create-board.dto";
import { BoardsService } from "../boards/boards.service";
import { ListTasksQueryDto } from "../tasks/dto/list-tasks-query.dto";
import { TasksService } from "../tasks/tasks.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ProjectsService } from "./projects.service";

@UseGuards(JwtAuthGuard)
@Controller()
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly boardsService: BoardsService,
    private readonly tasksService: TasksService,
    private readonly workspaceAccess: WorkspaceAccessService
  ) {}

  @UseGuards(WorkspaceRolesGuard)
  @Roles(Role.OWNER, Role.ADMIN, Role.MEMBER)
  @Post("workspaces/:workspaceId/projects")
  create(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateProjectDto
  ) {
    return this.projectsService.create(workspaceId, user.sub, dto);
  }

  @UseGuards(WorkspaceRolesGuard)
  @Get("workspaces/:workspaceId/projects")
  list(@Param("workspaceId") workspaceId: string) {
    return this.projectsService.list(workspaceId);
  }

  @Post("projects/:projectId/boards")
  async createBoard(
    @Param("projectId") projectId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateBoardDto
  ) {
    const { membership, project } = await this.workspaceAccess.requireProject(user.sub, projectId);
    this.workspaceAccess.assertCanWrite(membership);
    return this.boardsService.create(project, user.sub, dto);
  }

  @Get("projects/:projectId/tasks")
  async listTasks(
    @Param("projectId") projectId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListTasksQueryDto
  ) {
    const { project } = await this.workspaceAccess.requireProject(user.sub, projectId);
    return this.tasksService.listProjectTasks(project, query);
  }
}

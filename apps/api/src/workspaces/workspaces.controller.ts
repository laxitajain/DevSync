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
  UseGuards
} from "@nestjs/common";
import { Role, WorkspaceMember } from "@devsync/db";
import { CurrentUser, CurrentUserPayload } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentMembership } from "./decorators/current-membership.decorator";
import { WorkspaceRolesGuard } from "./guards/workspace-roles.guard";
import { WorkspacesService } from "./workspaces.service";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { InviteMemberDto } from "./dto/invite-member.dto";
import { UpdateMemberRoleDto } from "./dto/update-member-role.dto";

@UseGuards(JwtAuthGuard)
@Controller("workspaces")
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.workspacesService.listForUser(user.sub);
  }

  @HttpCode(HttpStatus.OK)
  @Post("invites/:token/accept")
  acceptInvite(@CurrentUser() user: CurrentUserPayload, @Param("token") token: string) {
    return this.workspacesService.acceptInvite(user.sub, user.email, token);
  }

  @UseGuards(WorkspaceRolesGuard)
  @Get(":workspaceId/summary")
  getSummary(@Param("workspaceId") workspaceId: string) {
    return this.workspacesService.getSummary(workspaceId);
  }

  @UseGuards(WorkspaceRolesGuard)
  @Get(":workspaceId/dashboard")
  getDashboard(@Param("workspaceId") workspaceId: string) {
    return this.workspacesService.getDashboard(workspaceId);
  }

  @UseGuards(WorkspaceRolesGuard)
  @Get(":workspaceId")
  getOne(@Param("workspaceId") workspaceId: string) {
    return this.workspacesService.getById(workspaceId);
  }

  @UseGuards(WorkspaceRolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Post(":workspaceId/invites")
  invite(
    @Param("workspaceId") workspaceId: string,
    @CurrentMembership() membership: WorkspaceMember,
    @Body() dto: InviteMemberDto
  ) {
    return this.workspacesService.inviteMember(workspaceId, membership, dto);
  }

  @UseGuards(WorkspaceRolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Patch(":workspaceId/members/:memberId/role")
  updateMemberRole(
    @Param("workspaceId") workspaceId: string,
    @Param("memberId") memberId: string,
    @CurrentMembership() membership: WorkspaceMember,
    @Body() dto: UpdateMemberRoleDto
  ) {
    return this.workspacesService.updateMemberRole(workspaceId, membership, memberId, dto.role);
  }

  @UseGuards(WorkspaceRolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Delete(":workspaceId/members/:memberId")
  removeMember(
    @Param("workspaceId") workspaceId: string,
    @Param("memberId") memberId: string,
    @CurrentMembership() membership: WorkspaceMember
  ) {
    return this.workspacesService.removeMember(workspaceId, membership, memberId);
  }
}

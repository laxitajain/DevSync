import { Module } from "@nestjs/common";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";
import { WorkspaceRolesGuard } from "./guards/workspace-roles.guard";
import { WorkspaceAccessService } from "./workspace-access.service";

@Module({
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceRolesGuard, WorkspaceAccessService],
  exports: [WorkspaceAccessService]
})
export class WorkspacesModule {}

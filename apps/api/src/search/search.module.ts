import { Module } from "@nestjs/common";
import { WorkspaceRolesGuard } from "../workspaces/guards/workspace-roles.guard";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";

@Module({
  controllers: [SearchController],
  providers: [SearchService, WorkspaceRolesGuard]
})
export class SearchModule {}

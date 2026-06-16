import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { WorkspaceRolesGuard } from "../workspaces/guards/workspace-roles.guard";
import { SearchQueryDto } from "./dto/search-query.dto";
import { SearchService } from "./search.service";

@UseGuards(JwtAuthGuard, WorkspaceRolesGuard)
@Controller("workspaces/:workspaceId/search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Param("workspaceId") workspaceId: string, @Query() query: SearchQueryDto) {
    return this.searchService.search(
      workspaceId,
      query.q,
      query.type ?? "all",
      query.limit ?? 20
    );
  }
}

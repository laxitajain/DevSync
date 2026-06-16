import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { WorkspaceMember } from "@devsync/db";

/**
 * Returns the membership that WorkspaceRolesGuard loaded for the current
 * caller + :workspaceId. Only valid on routes protected by that guard.
 */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WorkspaceMember => {
    const request = ctx.switchToHttp().getRequest<{ membership: WorkspaceMember }>();
    return request.membership;
  }
);

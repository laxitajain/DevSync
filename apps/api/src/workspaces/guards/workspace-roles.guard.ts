import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role, WorkspaceMember } from "@devsync/db";
import { PrismaService } from "../../prisma/prisma.service";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";

type RequestWithMembership = {
  user?: CurrentUserPayload;
  params: Record<string, string>;
  membership?: WorkspaceMember;
};

/**
 * Enforces two things for any `:workspaceId` route:
 *
 *  1. Tenant isolation: the caller must be a member of the workspace. Non-members
 *     get 404 (not 403) so we never leak whether a workspace exists.
 *  2. Role authorization: if the route declares @Roles(...), the caller's role
 *     must be in that set, otherwise 403.
 *
 * On success the membership is attached to the request for handlers/services to
 * reuse, avoiding a second lookup.
 *
 * Must run after JwtAuthGuard, which populates `request.user`.
 */
@Injectable()
export class WorkspaceRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithMembership>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException();
    }

    const workspaceId = request.params.workspaceId;
    if (!workspaceId) {
      return true;
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.sub } }
    });

    if (!membership) {
      throw new NotFoundException("Workspace not found");
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (requiredRoles?.length && !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException("Insufficient workspace role");
    }

    request.membership = membership;
    return true;
  }
}

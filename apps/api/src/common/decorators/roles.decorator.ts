import { SetMetadata } from "@nestjs/common";
import { Role } from "@devsync/db";

export const ROLES_KEY = "workspace_roles";

/**
 * Declares which workspace roles may invoke a route. The WorkspaceRolesGuard
 * reads this metadata after loading the caller's membership. Routes with no
 * @Roles still require membership (enforced by the guard), they just don't
 * restrict by role.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

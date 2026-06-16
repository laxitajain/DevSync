import { Role } from "@devsync/db";

/**
 * Privilege ordering for workspace roles. Higher rank = more authority.
 * Used to express rules like "an actor may only manage members strictly
 * below their own rank".
 */
export const ROLE_RANK: Record<Role, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
  VIEWER: 0
};

export function hasAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function outranks(actor: Role, target: Role): boolean {
  return ROLE_RANK[actor] > ROLE_RANK[target];
}

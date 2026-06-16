import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, Role, WorkspaceMember } from "@devsync/db";
import { PrismaService } from "../prisma/prisma.service";
import { generateToken, hashToken } from "../common/crypto/tokens";
import { outranks } from "../common/rbac/roles";
import { CacheService } from "../cache/cache.service";
import {
  WORKSPACE_DASHBOARD_TTL_SECONDS,
  WORKSPACE_SUMMARY_TTL_SECONDS,
  workspaceCacheKeys,
  workspaceDashboardKey,
  workspaceSummaryKey
} from "../cache/cache.keys";
import { JobsService } from "../jobs/jobs.service";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { InviteMemberDto } from "./dto/invite-member.dto";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly jobs: JobsService
  ) {}

  async create(userId: string, dto: CreateWorkspaceDto) {
    const slug = await this.generateUniqueSlug(dto.name);

    const workspace = await this.prisma.workspace.create({
      data: {
        name: dto.name.trim(),
        slug,
        members: {
          create: {
            userId,
            role: Role.OWNER
          }
        }
      }
    });

    return { ...workspace, role: Role.OWNER };
  }

  async listForUser(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: "asc" }
    });

    return memberships.map((membership) => ({
      ...membership.workspace,
      role: membership.role
    }));
  }

  async getById(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    return workspace;
  }

  async getSummary(workspaceId: string) {
    return this.cache.remember(
      workspaceSummaryKey(workspaceId),
      WORKSPACE_SUMMARY_TTL_SECONDS,
      async () => {
        const [projectCount, memberCount, openTaskCount] = await Promise.all([
          this.prisma.project.count({ where: { workspaceId } }),
          this.prisma.workspaceMember.count({ where: { workspaceId } }),
          this.prisma.task.count({
            where: {
              project: { workspaceId },
              column: { name: { not: "Done" } }
            }
          })
        ]);

        return { projectCount, memberCount, openTaskCount };
      }
    );
  }

  async getDashboard(workspaceId: string) {
    return this.cache.remember(
      workspaceDashboardKey(workspaceId),
      WORKSPACE_DASHBOARD_TTL_SECONDS,
      async () => {
        const [tasksByPriority, tasksByColumn, recentActivityCount] =
          await Promise.all([
            this.prisma.task.groupBy({
              by: ["priority"],
              where: { project: { workspaceId } },
              _count: { _all: true }
            }),
            this.prisma.task.groupBy({
              by: ["columnId"],
              where: { project: { workspaceId } },
              _count: { _all: true }
            }),
            this.prisma.activityLog.count({
              where: {
                workspaceId,
                createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
              }
            })
          ]);

        const columns = await this.prisma.boardColumn.findMany({
          where: { board: { project: { workspaceId } } },
          select: { id: true, name: true },
          orderBy: { position: "asc" }
        });

        const columnNames = new Map(columns.map((column) => [column.id, column.name]));

        return {
          tasksByPriority: tasksByPriority.map((row) => ({
            priority: row.priority,
            count: row._count._all
          })),
          tasksByColumn: tasksByColumn.map((row) => ({
            columnId: row.columnId,
            columnName: columnNames.get(row.columnId) ?? "Unknown",
            count: row._count._all
          })),
          recentActivityCount
        };
      }
    );
  }

  async inviteMember(workspaceId: string, actor: WorkspaceMember, dto: InviteMemberDto) {
    if (dto.role === Role.OWNER) {
      throw new BadRequestException("Cannot invite a member as OWNER");
    }

    // An actor may only grant roles strictly below their own. This stops an
    // ADMIN from minting another ADMIN and escalating laterally.
    if (!outranks(actor.role, dto.role)) {
      throw new ForbiddenException("You cannot grant a role at or above your own");
    }

    const email = dto.email.toLowerCase();

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const alreadyMember = await this.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: existingUser.id } }
      });
      if (alreadyMember) {
        throw new ConflictException("User is already a member of this workspace");
      }
    }

    const token = generateToken();

    // Replace any prior pending invite for this email so a workspace only ever
    // has one live invite per address.
    const invite = await this.prisma.$transaction(async (tx) => {
      await tx.workspaceInvite.deleteMany({
        where: { workspaceId, email, acceptedAt: null }
      });

      return tx.workspaceInvite.create({
        data: {
          workspaceId,
          email,
          role: dto.role,
          tokenHash: hashToken(token),
          invitedById: actor.userId,
          expiresAt: new Date(Date.now() + INVITE_TTL_MS)
        }
      });
    });

    await this.jobs.enqueueEmail({
      to: email,
      template: "workspace-invite",
      data: { workspaceId, token }
    });

    return {
      invite: this.serializeInvite(invite),
      // Returned directly only because email delivery arrives in a later
      // milestone; once queued email exists this should be sent, not returned.
      token
    };
  }

  async acceptInvite(userId: string, userEmail: string, token: string) {
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { tokenHash: hashToken(token) }
    });

    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired invite");
    }

    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ForbiddenException("This invite was issued for a different email");
    }

    try {
      const membership = await this.prisma.$transaction(async (tx) => {
        const created = await tx.workspaceMember.create({
          data: {
            workspaceId: invite.workspaceId,
            userId,
            role: invite.role
          }
        });

        await tx.workspaceInvite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date() }
        });

        return created;
      });

      await this.invalidateWorkspaceCache(invite.workspaceId);
      return membership;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("You are already a member of this workspace");
      }
      throw error;
    }
  }

  async updateMemberRole(
    workspaceId: string,
    actor: WorkspaceMember,
    memberId: string,
    nextRole: Role
  ) {
    if (nextRole === Role.OWNER) {
      throw new BadRequestException("Ownership transfer is not supported here");
    }

    const target = await this.findMemberInWorkspace(workspaceId, memberId);

    if (target.id === actor.id) {
      throw new BadRequestException("You cannot change your own role");
    }

    // The actor must outrank both the member's current role and the role being
    // assigned. Owners are therefore unmanageable here (nobody outranks OWNER),
    // which also makes last-owner demotion impossible by construction.
    if (!outranks(actor.role, target.role) || !outranks(actor.role, nextRole)) {
      throw new ForbiddenException("You cannot manage this member");
    }

    const updated = await this.prisma.workspaceMember.update({
      where: { id: target.id },
      data: { role: nextRole }
    });

    await this.invalidateWorkspaceCache(workspaceId);
    return updated;
  }

  async removeMember(workspaceId: string, actor: WorkspaceMember, memberId: string) {
    const target = await this.findMemberInWorkspace(workspaceId, memberId);

    if (target.id === actor.id) {
      throw new BadRequestException("Use leave-workspace to remove yourself");
    }

    if (!outranks(actor.role, target.role)) {
      throw new ForbiddenException("You cannot remove this member");
    }

    await this.prisma.workspaceMember.delete({ where: { id: target.id } });
    await this.invalidateWorkspaceCache(workspaceId);
    return { success: true };
  }

  async invalidateWorkspaceCache(workspaceId: string) {
    await this.cache.del(...workspaceCacheKeys(workspaceId));
  }

  private async findMemberInWorkspace(workspaceId: string, memberId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId }
    });

    if (!member || member.workspaceId !== workspaceId) {
      throw new NotFoundException("Member not found");
    }

    return member;
  }

  private async generateUniqueSlug(name: string) {
    const base =
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50) || "workspace";

    let slug = base;
    while (await this.prisma.workspace.findUnique({ where: { slug } })) {
      slug = `${base}-${generateToken(3)}`;
    }

    return slug;
  }

  private serializeInvite(invite: {
    id: string;
    workspaceId: string;
    email: string;
    role: Role;
    expiresAt: Date;
    acceptedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: invite.id,
      workspaceId: invite.workspaceId,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      createdAt: invite.createdAt
    };
  }
}

import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@devsync/db";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../cache/cache.service";
import { workspaceCacheKeys } from "../cache/cache.keys";
import { CreateProjectDto } from "./dto/create-project.dto";

const DEFAULT_COLUMNS = ["To Do", "In Progress", "Done"];

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService
  ) {}

  async create(workspaceId: string, actorId: string, dto: CreateProjectDto) {
    try {
      const project = await this.prisma.$transaction(async (tx) => {
        const project = await tx.project.create({
          data: {
            workspaceId,
            name: dto.name.trim(),
            key: dto.key.trim().toUpperCase(),
            description: dto.description?.trim() || null
          }
        });

        await tx.board.create({
          data: {
            projectId: project.id,
            name: "Main Board",
            columns: {
              create: DEFAULT_COLUMNS.map((name, index) => ({
                name,
                position: (index + 1) * 1000
              }))
            }
          }
        });

        await tx.activityLog.create({
          data: {
            workspaceId,
            projectId: project.id,
            actorId,
            action: "project.created",
            metadata: { name: project.name, key: project.key }
          }
        });

        return project;
      });
      await this.cache.del(...workspaceCacheKeys(workspaceId));
      return project;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Project key is already used in this workspace");
      }
      throw error;
    }
  }

  list(workspaceId: string) {
    return this.prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      include: {
        boards: {
          select: { id: true, name: true, createdAt: true },
          orderBy: { createdAt: "asc" }
        }
      }
    });
  }
}

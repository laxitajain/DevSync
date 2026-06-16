import { Injectable } from "@nestjs/common";
import { Project } from "@devsync/db";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBoardDto } from "./dto/create-board.dto";

const DEFAULT_COLUMNS = ["To Do", "In Progress", "Done"];

@Injectable()
export class BoardsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(project: Project, actorId: string, dto: CreateBoardDto) {
    return this.prisma.$transaction(async (tx) => {
      const board = await tx.board.create({
        data: {
          projectId: project.id,
          name: dto.name.trim(),
          columns: {
            create: DEFAULT_COLUMNS.map((name, index) => ({
              name,
              position: (index + 1) * 1000
            }))
          }
        },
        include: {
          columns: { orderBy: { position: "asc" } }
        }
      });

      await tx.activityLog.create({
        data: {
          workspaceId: project.workspaceId,
          projectId: project.id,
          actorId,
          action: "board.created",
          metadata: { boardId: board.id, name: board.name }
        }
      });

      return board;
    });
  }

  getById(boardId: string) {
    return this.prisma.board.findUnique({
      where: { id: boardId },
      include: {
        project: { select: { id: true, name: true, key: true, workspaceId: true } },
        columns: {
          orderBy: { position: "asc" },
          include: {
            tasks: {
              orderBy: { position: "asc" },
              include: {
                assignees: {
                  include: { user: { select: { id: true, email: true, name: true } } }
                }
              }
            }
          }
        }
      }
    });
  }
}

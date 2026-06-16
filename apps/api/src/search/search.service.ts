import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SearchType } from "./dto/search-query.dto";

/**
 * Workspace-scoped full-text search over tasks, comments, and projects.
 *
 * Uses Postgres' built-in FTS at query time: `websearch_to_tsquery` parses the
 * user's input (supporting quoted phrases and `-exclusions`) and `ts_rank`
 * orders by relevance. Every query is parameterized, so the user input is never
 * concatenated into SQL.
 *
 * For larger datasets these expression lookups should be backed by GIN indexes,
 * e.g.:
 *   CREATE INDEX "Task_fts_idx" ON "Task"
 *     USING GIN (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')));
 * They are left out of the schema because Prisma cannot express expression
 * indexes, and adding them via raw migrations creates `migrate dev` drift.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(workspaceId: string, query: string, type: SearchType, limit: number) {
    const wantTasks = type === "all" || type === "tasks";
    const wantComments = type === "all" || type === "comments";
    const wantProjects = type === "all" || type === "projects";

    const [tasks, comments, projects] = await Promise.all([
      wantTasks ? this.searchTasks(workspaceId, query, limit) : Promise.resolve([]),
      wantComments ? this.searchComments(workspaceId, query, limit) : Promise.resolve([]),
      wantProjects ? this.searchProjects(workspaceId, query, limit) : Promise.resolve([])
    ]);

    return { query, tasks, comments, projects };
  }

  private searchTasks(workspaceId: string, query: string, limit: number) {
    return this.prisma.$queryRaw<
      Array<{ id: string; title: string; description: string | null; projectId: string; rank: number }>
    >`
      SELECT t.id,
             t.title,
             t.description,
             t."projectId",
             ts_rank(
               to_tsvector('english', coalesce(t.title, '') || ' ' || coalesce(t.description, '')),
               websearch_to_tsquery('english', ${query})
             ) AS rank
      FROM "Task" t
      JOIN "Project" p ON p.id = t."projectId"
      WHERE p."workspaceId" = ${workspaceId}
        AND to_tsvector('english', coalesce(t.title, '') || ' ' || coalesce(t.description, ''))
            @@ websearch_to_tsquery('english', ${query})
      ORDER BY rank DESC, t."createdAt" DESC
      LIMIT ${limit}
    `;
  }

  private searchComments(workspaceId: string, query: string, limit: number) {
    return this.prisma.$queryRaw<
      Array<{ id: string; body: string; taskId: string; projectId: string; rank: number }>
    >`
      SELECT c.id,
             c.body,
             c."taskId",
             t."projectId",
             ts_rank(to_tsvector('english', c.body), websearch_to_tsquery('english', ${query})) AS rank
      FROM "TaskComment" c
      JOIN "Task" t ON t.id = c."taskId"
      JOIN "Project" p ON p.id = t."projectId"
      WHERE p."workspaceId" = ${workspaceId}
        AND to_tsvector('english', c.body) @@ websearch_to_tsquery('english', ${query})
      ORDER BY rank DESC, c."createdAt" DESC
      LIMIT ${limit}
    `;
  }

  private searchProjects(workspaceId: string, query: string, limit: number) {
    return this.prisma.$queryRaw<
      Array<{ id: string; name: string; key: string; description: string | null; rank: number }>
    >`
      SELECT p.id,
             p.name,
             p.key,
             p.description,
             ts_rank(
               to_tsvector(
                 'english',
                 coalesce(p.name, '') || ' ' || coalesce(p.key, '') || ' ' || coalesce(p.description, '')
               ),
               websearch_to_tsquery('english', ${query})
             ) AS rank
      FROM "Project" p
      WHERE p."workspaceId" = ${workspaceId}
        AND to_tsvector(
              'english',
              coalesce(p.name, '') || ' ' || coalesce(p.key, '') || ' ' || coalesce(p.description, '')
            ) @@ websearch_to_tsquery('english', ${query})
      ORDER BY rank DESC, p."createdAt" DESC
      LIMIT ${limit}
    `;
  }
}

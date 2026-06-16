# Milestone 3 Design Note — Projects, Boards, Tasks

> Implementation spec for the core project-management system. This is written so
> it can be executed by any capable model/developer **without re-deriving the
> design decisions**. Follow the patterns already established in Milestones 1–2.

## 0. Conventions to follow (already in the repo)

- **Module shape:** mirror `apps/api/src/workspaces/` — `*.module.ts`,
  `*.controller.ts`, `*.service.ts`, `dto/`, plus guards/decorators where needed.
- **Auth:** every route is behind `JwtAuthGuard` (controller-level
  `@UseGuards(JwtAuthGuard)`). `request.user` is `{ sub, email }`.
- **Tenant isolation rule (unchanged):** a caller who is **not a member** of the
  owning workspace gets **404**, never 403. A member who lacks the **role** for a
  write gets **403**.
- **Roles:** reuse `Role` from `@devsync/db` and the `ROLE_RANK` / `outranks` /
  `hasAtLeast` helpers in `apps/api/src/common/rbac/roles.ts`.
- **Tokens/secrets:** reuse `common/crypto/tokens.ts` if any tokens are needed
  (none expected in M3).
- **HTTP codes:** `POST` that creates a resource → 201; other `POST`/`PATCH`/
  `DELETE` → 200 via `@HttpCode(HttpStatus.OK)`. Validation via the global
  `ValidationPipe` (`whitelist + forbidNonWhitelisted + transform`).
- **Tests:** add `*.e2e-spec.ts` files using the existing harness
  (`test/utils/test-app.ts`, `resetDatabase`, `registerUser`, `bearer`). Run
  against the real `devsync_test` schema. **Extend the `TABLES` list in
  `test/utils/database.ts`** to include the new tables (most-dependent first).

## 1. Authorization model (the important decision)

The M2 `WorkspaceRolesGuard` resolves membership from `request.params.workspaceId`.
M3 introduces **flat routes** with no `workspaceId` in the path
(`/boards/:boardId`, `/tasks/:taskId`, …). Decision:

- **Routes that DO carry `:workspaceId`** (the project list/create endpoints) keep
  using `WorkspaceRolesGuard` + `@Roles(...)` exactly like M2.
- **Flat routes** resolve the owning workspace from the resource id inside a
  shared **`WorkspaceAccessService`**, which returns both the membership and the
  loaded resource (so the service doesn't fetch twice). Non-member → 404.

Why this split: the path shape dictates the mechanism. A guard can't cleanly read
a body/owned-resource it hasn't loaded, and loading the resource in the service is
needed anyway. Keep one helper so the rule lives in one place.

Create `apps/api/src/workspaces/workspace-access.service.ts` (export it from
`WorkspacesModule`, then import that module where needed):

```ts
@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireMembership(userId: string, workspaceId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } }
    });
    if (!membership) throw new NotFoundException("Workspace not found");
    return membership;
  }

  // Each of these loads the resource (404 if missing OR caller not a member),
  // then returns { membership, <resource> }. Use `select`/`include` to also
  // pull the parent ids you need (e.g. board -> project.workspaceId).
  async requireProject(userId: string, projectId: string) { /* ... */ }
  async requireBoard(userId: string, boardId: string) { /* ... */ }
  async requireTask(userId: string, taskId: string) { /* ... */ }

  // Write authorization: VIEWER is read-only everywhere in M3.
  assertCanWrite(membership: WorkspaceMember) {
    if (!hasAtLeast(membership.role, Role.MEMBER)) {
      throw new ForbiddenException("Insufficient workspace role");
    }
  }
}
```

**Role policy for M3:**
- **Read** (GET) — any member (OWNER/ADMIN/MEMBER/VIEWER).
- **Write** (create/update/delete project, board, column, task, comment;
  assign; move) — **MEMBER and above** (i.e. not VIEWER). Use `assertCanWrite`.
- No finer-grained rules in M3 (e.g. "only author can edit comment") unless noted
  below — keep scope tight.

## 2. Schema (add to `packages/db/prisma/schema.prisma`)

Design decisions baked in:
- **Status = column.** A task's lane/status is its `BoardColumn`. There is no
  separate status enum — one source of truth. "Status change" == "move to another
  column".
- **Ordering = integer `position`** per parent, kept gapped (see §4). Columns are
  ordered within a board; tasks are ordered within a column.
- **Assignees** are a many-to-many join (`TaskAssignee`).
- **ActivityLog** is workspace-scoped with optional project/task pointers and a
  JSON `metadata` blob; `action` is a string enum-like value (see §5).
- Add `@@index` on every foreign key used for lookups/sorting.

```prisma
model Project {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  name        String
  key         String    // short uppercase code, unique within the workspace (e.g. "ENG")
  description String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  boards      Board[]
  tasks       Task[]

  @@unique([workspaceId, key])
  @@index([workspaceId])
}

model Board {
  id        String        @id @default(cuid())
  projectId String
  project   Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name      String
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  columns   BoardColumn[]

  @@index([projectId])
}

model BoardColumn {
  id        String   @id @default(cuid())
  boardId   String
  board     Board    @relation(fields: [boardId], references: [id], onDelete: Cascade)
  name      String
  position  Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  tasks     Task[]

  @@index([boardId])
}

model Task {
  id          String          @id @default(cuid())
  projectId   String          // denormalized for workspace resolution + project-wide queries
  project     Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  columnId    String
  column      BoardColumn     @relation(fields: [columnId], references: [id], onDelete: Cascade)
  title       String
  description String?
  position    Int
  priority    TaskPriority    @default(MEDIUM)
  dueAt       DateTime?
  createdById String?
  createdBy   User?           @relation("TasksCreated", fields: [createdById], references: [id], onDelete: SetNull)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  assignees   TaskAssignee[]
  comments    TaskComment[]

  @@index([projectId])
  @@index([columnId])
  @@index([projectId, createdAt, id]) // keyset pagination
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model TaskAssignee {
  taskId     String
  task       Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  assignedAt DateTime @default(now())

  @@id([taskId, userId])
  @@index([userId])
}

model TaskComment {
  id        String   @id @default(cuid())
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  authorId  String?
  author    User?    @relation("CommentsAuthored", fields: [authorId], references: [id], onDelete: SetNull)
  body      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([taskId, createdAt, id]) // keyset pagination
}

model ActivityLog {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  projectId   String?
  taskId      String?
  actorId     String?
  actor       User?     @relation("ActivityActor", fields: [actorId], references: [id], onDelete: SetNull)
  action      String    // see §5 for the allowed set
  metadata    Json?
  createdAt   DateTime  @default(now())

  @@index([workspaceId, createdAt, id])
  @@index([taskId, createdAt, id])
}
```

**Back-relations to add on existing models** (Prisma requires both sides):
- `User`: `tasksCreated TasksCreated`, `commentsAuthored`, `taskAssignments TaskAssignee[]`, `activity ActivityLog[] @relation("ActivityActor")` (match relation names above).
- `Workspace`: `projects Project[]`, `activity ActivityLog[]`.

Migration:
```bash
cd packages/db && npx prisma migrate dev --name projects_boards_tasks
# then rebuild the db package so dist types update:
npm run build --workspace @devsync/db
```

## 3. Endpoints

| Method | Path | Auth | Body / Query | Notes |
|---|---|---|---|---|
| POST | `/workspaces/:workspaceId/projects` | `WorkspaceRolesGuard` + `@Roles(OWNER,ADMIN,MEMBER)` | `{ name, key, description? }` | 201. Validate `key` unique within workspace (catch P2002 → 409). Optionally auto-create a default board+columns in the same transaction. |
| GET | `/workspaces/:workspaceId/projects` | `WorkspaceRolesGuard` (any role) | — | List projects in workspace. |
| POST | `/projects/:projectId/boards` | `WorkspaceAccessService.requireProject` + `assertCanWrite` | `{ name }` | 201. Create board + default columns (`To Do`, `In Progress`, `Done`) with positions in a transaction. |
| GET | `/boards/:boardId` | `requireBoard` (any role) | — | Return board with columns (ordered by `position`) and each column's tasks (ordered by `position`). |
| POST | `/boards/:boardId/tasks` | `requireBoard` + `assertCanWrite` | `{ title, description?, columnId?, priority?, dueAt?, assigneeIds?[] }` | 201. Default to first column if `columnId` omitted. Validate `columnId` belongs to the board and any `assigneeIds` are workspace members. Set `position` to end of column (§4). Record `task.created`. |
| PATCH | `/tasks/:taskId` | `requireTask` + `assertCanWrite` | partial: `{ title?, description?, priority?, dueAt?, columnId?, position?, assigneeIds?[] }` | 200. If `columnId`/`position` change → it's a **move** (§4) → record `task.moved`. Other field changes → record `task.updated` (include changed fields in metadata). `assigneeIds` replaces the assignee set; record `task.assignees_changed`. Do it all in one transaction. |
| DELETE | `/tasks/:taskId` | `requireTask` + `assertCanWrite` | — | 200. Delete task (cascades comments/assignees). Record `task.deleted` (task is gone, so log carries `taskId: null` + title in metadata, or keep `taskId` and accept dangling — prefer metadata snapshot). |
| POST | `/tasks/:taskId/comments` | `requireTask` + `assertCanWrite` | `{ body }` | 201. Record `comment.created`. |
| GET | `/tasks/:taskId/activity` | `requireTask` (any role) | `?limit=&cursor=` | Keyset-paginated activity for the task, newest first (§6). |

Add list endpoints for tasks with filtering/sorting (roadmap: "Cursor pagination for task lists", "Filtering and sorting"):

| Method | Path | Auth | Query | Notes |
|---|---|---|---|---|
| GET | `/projects/:projectId/tasks` | `requireProject` (any role) | `?limit=&cursor=&columnId=&assigneeId=&priority=&q=&sort=` | Keyset pagination (§6). Filters are ANDed `where` clauses. `sort` ∈ {`createdAt`,`-createdAt`,`dueAt`,`-dueAt`}; default `-createdAt`. `q` = case-insensitive `contains` on title (real full-text search lands in M8). |

DTOs to create (one file each under `dto/`, class-validator decorated):
`CreateProjectDto`, `CreateBoardDto`, `CreateTaskDto`, `UpdateTaskDto`,
`CreateCommentDto`, `ListTasksQueryDto`, `ActivityQueryDto`. Use `@IsEnum(TaskPriority)`,
`@IsArray()+@IsString({each:true})` for `assigneeIds`, `@IsInt()/@Min()` + `@Type`
for pagination, `@IsISO8601()` for `dueAt`.

## 4. Ordering (`position`)

Per parent (columns within a board; tasks within a column), keep an **integer
`position` with gaps** so most operations are cheap:

- **Insert at end:** `position = (max(position in parent) ?? 0) + 1000`.
- **Move between two neighbors A (above) and B (below):**
  `position = floor((A.position + B.position) / 2)`. If A and B are adjacent
  (gap ≤ 1) → **rebalance** that parent's children to `1000, 2000, 3000, …` in a
  transaction, then place.
- **Move to top:** `position = min(position) - 1000` (or rebalance if it would go ≤ 0).

Always read neighbors + write inside a single `prisma.$transaction` so concurrent
moves can't interleave into an inconsistent order. Ordering reads use
`orderBy: { position: "asc" }`.

> Alternative worth a sentence in the README: fractional/LexoRank string ranks
> avoid rebalancing entirely. Integer-with-gaps is chosen here for readability.

## 5. Activity log

Write the log entry **in the same transaction** as the mutation it describes, so
an activity row never exists without its change (and vice versa). Add a helper on
the service:

```ts
private recordActivity(
  tx: Prisma.TransactionClient,
  input: { workspaceId: string; actorId: string; action: ActivityAction;
           projectId?: string; taskId?: string; metadata?: Prisma.InputJsonValue }
) {
  return tx.activityLog.create({ data: { ...input } });
}
```

Allowed `action` values (define a TS union/const, store as string):
`project.created`, `board.created`, `task.created`, `task.updated`,
`task.moved`, `task.deleted`, `task.assignees_changed`, `comment.created`.

`metadata` examples: `task.moved` → `{ fromColumnId, toColumnId }`;
`task.updated` → `{ changed: { title?: [old,new], priority?: [old,new] } }`;
`task.assignees_changed` → `{ added: [...], removed: [...] }`.

## 6. Cursor (keyset) pagination

Do **not** use offset/`skip` (it drifts as rows change). Use keyset pagination on
`(createdAt, id)`:

- `orderBy: [{ createdAt: "desc" }, { id: "desc" }]` (or `asc` for `dueAt` sorts).
- Fetch `take: limit + 1`. If `limit+1` rows come back, there's a next page; drop
  the extra and build `nextCursor` from the last returned row.
- Cursor is an opaque base64 of `${createdAt.toISOString()}|${id}`. Decode it into
  a `where` clause:

```ts
where: {
  ...filters,
  OR: [
    { createdAt: { lt: cur.createdAt } },
    { createdAt: cur.createdAt, id: { lt: cur.id } }
  ]
}
```

Response shape (use everywhere paginated):
```ts
{ items: T[], nextCursor: string | null }
```
Add small `encodeCursor(row)` / `decodeCursor(str)` helpers in
`apps/api/src/common/pagination/cursor.ts`. Clamp `limit` to `[1, 100]`, default 20.

## 7. Transaction boundaries (summary)

Wrap each of these in one `$transaction`:
- Create project (+ optional default board/columns) + `project.created` log.
- Create board + default columns + `board.created` log.
- Create task (compute position, attach assignees) + `task.created` log.
- Update/move task (read neighbors, possible rebalance, update, diff assignees) +
  the appropriate log(s).
- Delete task + `task.deleted` log.
- Create comment + `comment.created` log.

## 8. Testing checklist (add `projects.e2e-spec.ts`, `tasks.e2e-spec.ts`)

Reuse `registerUser` + `bearer`; build a small helper to create a workspace, a
project, and a board for a given owner. Cover:

- **AuthZ:** non-member gets 404 on every flat route; VIEWER gets 403 on writes
  but 200 on reads; MEMBER can do task CRUD.
- **Projects:** create (201, `key` echoed), duplicate `key` in same workspace →
  409, list returns only that workspace's projects.
- **Boards:** create board auto-creates the 3 default columns in order.
- **Tasks:** create (defaults to first column, position set), move across columns
  updates `columnId` and order; PATCH updates fields; assignee set replace;
  non-member assignee rejected; delete cascades comments.
- **Comments:** create + appears in task; activity records `comment.created`.
- **Activity:** after a sequence of changes, `GET /tasks/:taskId/activity` returns
  entries newest-first and paginates with `nextCursor`.
- **Pagination:** seed > limit tasks, walk pages via `nextCursor` until null,
  assert no dupes/missing and that filters (`columnId`, `priority`, `q`) narrow
  results.

Run: `npm run test:e2e --workspace @devsync/api` (global setup migrates the test
schema automatically) and `npx tsc -p apps/api/tsconfig.json --noEmit`.

## 9. Out of scope for M3 (deferred on purpose)

- Real full-text search + ranking → **M8** (use `contains` for `q` now).
- Realtime task/comment broadcasting → **M5**.
- Activity/notification fan-out via queues → **M7** (write logs synchronously now).
- Per-comment author-only edit/delete, board/column rename/delete endpoints,
  ownership-transfer — add later if needed; not required to satisfy the milestone.

## 10. "Done when" (from the roadmap)

- Users can manage projects, boards, columns, tasks, and comments.
- Task changes are recorded in the activity log (same transaction).
- Task/activity lists are keyset-paginated; filtering + sorting work.
- Prisma migration is clean and the full e2e suite is green.

# DevSync

DevSync is a realtime collaborative project management SaaS built to learn production-style backend engineering.

Current sprint:

- Milestone 0: monorepo, NestJS API, Next.js web app, PostgreSQL, Redis, Prisma, and health check.
- Milestone 1: user auth, password hashing, JWT access tokens, refresh token rotation, protected route, and email/reset placeholders.
- Milestone 2: workspaces, invites, members, role-based access control, and multi-tenant isolation.
- Milestone 3: projects, boards, columns, tasks, assignees, comments, activity logs, filtering, sorting, and keyset pagination.
- Milestone 4: Next.js frontend MVP — auth screens, protected app shell, workspace switcher, project list, Kanban board with a task detail panel and comments, and member management. TanStack Query for server state, Zustand for auth.
- Milestone 5: Socket.IO realtime — JWT-authed gateway, workspace/project/user rooms scoped to members, live task and comment updates, online presence per workspace, comment typing indicators, and per-user notifications.
- Milestone 6: Redis-backed cache-aside workspace aggregates, API/auth rate limiting, cache invalidation after writes, and Redis-backed presence state.
- Milestone 7: BullMQ queues for email/notification delivery, separate worker bootstrap, retry/backoff policy, and repeatable maintenance cleanup jobs.
- Milestone 8: workspace-scoped full-text search (tasks, comments, projects) with relevance ranking, plus S3-compatible object storage for task attachments and profile avatars with signed download URLs.
- Milestone 9: production-aware observability and security — structured Pino logging, propagated request IDs, a consistent global error shape, Prometheus metrics, plus Helmet, CORS, and global validation.
- Milestone 10: portfolio readiness — unit tests for core helpers, full integration/RBAC e2e coverage, a realistic demo seed, OpenAPI/Swagger docs, a multi-stage Docker image, GitHub Actions CI, and deployment docs.

## Architecture

DevSync is a TypeScript monorepo with three runnable processes (API, BullMQ
worker, Next.js web) over PostgreSQL, Redis, and S3-compatible object storage.
See [`docs/deployment.md`](docs/deployment.md) for the full diagram, environment
reference, and deployment targets.

## Local Setup

Copy the environment file:

```sh
cp .env.example .env
cp packages/db/.env.example packages/db/.env
```

Start infrastructure:

```sh
docker compose up -d
```

Install dependencies:

```sh
npm install
```

Generate Prisma client and run migrations:

```sh
npm run db:generate
npm run db:migrate -- --name local_changes
```

Start the API:

```sh
npm run dev:api
```

Start the web app:

```sh
npm run dev:web
```

Start the background worker:

```sh
npm run dev:worker
```

Seed realistic demo data (optional):

```sh
npm run db:deploy   # apply migrations (prisma migrate deploy)
npm run db:seed     # one workspace, four members across all roles, projects + tasks
```

Demo login after seeding: `olivia@devsync.dev` / `Password123!`

## Testing

```sh
npm run test        # unit tests (pure helpers: RBAC, cursors, token hashing)
npm run test:e2e    # integration tests against a real Postgres `devsync_test` schema
```

CI (`.github/workflows/ci.yml`) runs both suites plus a typecheck and build on
every push/PR using Postgres + Redis service containers.

## API Routes

```txt
GET  /api/health        # liveness/readiness
GET  /metrics           # Prometheus scrape target (no /api prefix)
GET  /api/docs          # Swagger UI (OpenAPI)
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/verify-email
POST /api/auth/forgot-password
POST /api/auth/reset-password

POST /api/workspaces
GET  /api/workspaces
GET  /api/workspaces/:workspaceId
GET  /api/workspaces/:workspaceId/summary
GET  /api/workspaces/:workspaceId/dashboard
POST /api/workspaces/:workspaceId/invites
POST /api/workspaces/invites/:token/accept
PATCH /api/workspaces/:workspaceId/members/:memberId/role
DELETE /api/workspaces/:workspaceId/members/:memberId

POST /api/workspaces/:workspaceId/projects
GET  /api/workspaces/:workspaceId/projects
POST /api/projects/:projectId/boards
GET  /api/projects/:projectId/tasks
GET  /api/boards/:boardId
POST /api/boards/:boardId/tasks
GET  /api/tasks/:taskId
PATCH /api/tasks/:taskId
DELETE /api/tasks/:taskId
POST /api/tasks/:taskId/comments
GET  /api/tasks/:taskId/activity

GET  /api/workspaces/:workspaceId/search?q=...&type=all|tasks|comments|projects&limit=...

POST   /api/tasks/:taskId/attachments      # multipart "file"
GET    /api/tasks/:taskId/attachments
DELETE /api/attachments/:attachmentId
GET    /api/users/me/avatar
POST   /api/users/me/avatar                 # multipart "file"
```

## Realtime (Socket.IO)

The API exposes a Socket.IO gateway on the same port (default `4000`). Clients
authenticate by passing the access token in the connection handshake
(`auth.token`). Membership is verified server-side before a socket can join any
room, so events never reach unauthorized users.

```txt
# client → server (control)
workspace:join { workspaceId }      # verifies membership, joins presence
workspace:leave { workspaceId }
project:join { projectId }          # verifies membership of the project's workspace
project:leave { projectId }
comment:typing { projectId, taskId, isTyping }

# server → client (broadcast)
task:created | task:updated | task:moved | task:deleted   # to project room
comment:created                                            # to project room
presence:updated { workspaceId, onlineUserIds }            # to workspace room
comment:typing { taskId, userId, email, isTyping }         # to project room
notification:new { type, taskId, title, projectId }        # to user room (new assignees)
```

## Web App

The Next.js app reads two public env vars (defaults shown):

```sh
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_WS_URL=http://localhost:4000
```

## Search

`GET /api/workspaces/:workspaceId/search` runs Postgres full-text search across
tasks (title + description), comments (body), and projects (name + key +
description), scoped to the workspace and ordered by `ts_rank` relevance. Input
is parsed with `websearch_to_tsquery`, so quoted `"phrases"` and `-exclusions`
work. Results are grouped: `{ query, tasks, comments, projects }`.

## File Storage

Attachments and avatars are streamed to S3-compatible object storage (MinIO
locally via `docker-compose`, configured by the `S3_*` env vars). The database
stores only an object key; file contents live outside Postgres. Reads return
short-lived signed URLs rather than proxying bytes through the API. Uploads are
validated for size and MIME type. In `NODE_ENV=test` an in-memory storage
implementation is used so the e2e suite needs no MinIO.

## Observability & Security

Every request flows through structured logging and is traceable end-to-end:

- **Structured logs**: Pino via `nestjs-pino`. One JSON access log per request
  in non-dev environments; pretty single-line output in local dev. Nest's own
  startup logs are buffered and routed through the same logger.
- **Request IDs**: an inbound `X-Request-Id` is honored (otherwise one is
  minted), echoed on the response header, attached to every log line, and
  included in error response bodies — so a failing call maps to a log line.
- **Consistent errors**: a single global filter shapes every error as
  `{ statusCode, error, requestId, path, timestamp }`. 5xx logs at `error` with
  a stack; 4xx logs at `warn`.
- **Metrics**: `GET /metrics` exposes default process metrics plus
  `http_request_duration_seconds` / `http_requests_total`, labeled by method,
  route *pattern*, and status (kept off the `/api` prefix for conventional
  scraping).
- **Hardening**: Helmet security headers, explicit CORS allow-list, global
  `ValidationPipe` (whitelist + reject unknown fields), Redis-backed rate
  limiting, and Prisma's parameterized queries (including the raw FTS queries)
  for SQL-injection safety.

## Background Jobs

The API enqueues fire-and-forget work through BullMQ, backed by `REDIS_URL`. Run
the worker separately with `npm run dev:worker` in development or
`npm run start:worker --workspace @devsync/api` after building.

```txt
email         send-email       # verification, password reset, workspace invites
notifications deliver          # durable notification delivery for assignments
activity      record           # reserved for derived activity/feed fan-out
maintenance   cleanup-expired  # repeatable cleanup every 10 minutes
```

## Backend Design Notes

- Workspace and project data is tenant-isolated server-side. Non-members receive `404` for workspace-owned resources so the API does not leak whether another tenant's resource exists.
- Workspace roles are hierarchical: `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`. Viewers can read project-management data, while members and above can write.
- Task status is represented by the task's `BoardColumn`; there is no separate status enum to keep one source of truth.
- Ordered columns and tasks use integer positions with gaps (`1000`, `2000`, `3000`, ...). Most inserts and moves only assign a midpoint position; when gaps are exhausted, the affected column is rebalanced inside a transaction. LexoRank-style string ranks would avoid rebalancing, but integer gaps are easier to understand for this learning project.
- Task and activity list endpoints use keyset pagination instead of offset pagination.
- The realtime gateway authenticates the Socket.IO handshake with the same JWT access secret as the REST API and re-checks workspace membership on every room join, so authorization is enforced in both transports rather than trusting the client.
- Domain services emit realtime events only after their database transaction commits, via a thin `RealtimeService` indirection. This keeps the gateway out of the services' dependency graph and ensures clients never receive an event for a write that was rolled back.
- Presence is tracked in Redis hashes (`presence:ws:{workspaceId}`) and still emits the same `presence:updated` payload to clients. Multi-node Socket.IO event fan-out remains a later scaling milestone.
- The web client keeps server state in TanStack Query and treats realtime events as cache-invalidation signals (refetch the affected board/task) rather than patching cache by hand, which keeps the source of truth on the server.
- Cached workspace `summary` and `dashboard` reads use cache-aside with short TTLs. Writes that affect workspace aggregates invalidate the relevant keys after the transaction commits.
- Queue producers are best-effort from request handlers; processors are idempotent and retry with exponential backoff in the separate worker process.
- Full-text search runs at query time with parameterized `to_tsvector`/`websearch_to_tsquery`/`ts_rank`. Expression GIN indexes (the production optimization) are intentionally not added via raw migrations because Prisma cannot represent them, which would create `migrate dev` drift; the recommended index SQL is documented in `SearchService`.
- Object storage sits behind a `StorageService` abstraction so the same upload/list/delete and signed-URL code runs against MinIO, AWS S3, or Cloudflare R2 by swapping env, and against an in-memory fake in tests.
- Logging, the error filter, and metrics are wired through `configureApp` and a global interceptor so the e2e suite exercises the exact same request pipeline as production; the logger is silenced in `NODE_ENV=test` to keep test output clean.
- Metrics label requests by route *pattern* (`/tasks/:taskId`) rather than concrete URL to keep Prometheus label cardinality bounded.
- The demo seed is idempotent (it resets demo data first) and shares one password across users so a reviewer can sign in immediately; passwords are still argon2-hashed exactly as real registration does.
- The API and worker ship as one Docker image with two entry points (`main.js` / `worker.js`); the full `node_modules` (with the generated Prisma client and engine) is copied into the runtime stage so the client is never re-derived at boot.

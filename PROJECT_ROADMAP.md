# DevSync Project Roadmap

DevSync is a production-style collaborative project management platform built to teach backend engineering through one serious portfolio project.

The goal is not to clone Jira, Slack, Trello, and Notion all at once. The goal is to build a focused SaaS product with real backend depth: authentication, authorization, relational data, caching, queues, realtime collaboration, file handling, search, monitoring, testing, and deployment.

## Product Target

DevSync helps teams manage work inside shared workspaces.

Core user experience:

- Users create workspaces.
- Workspace members collaborate on projects.
- Projects contain boards, columns, tasks, comments, and attachments.
- Task updates appear in realtime.
- Members receive notifications.
- Admins can manage roles and permissions.
- Teams can search their workspace and inspect activity history.

Portfolio positioning:

- "A realtime collaborative project management SaaS built with NestJS, PostgreSQL, Redis, Prisma, Socket.IO, BullMQ, and Next.js."

## Recommended Stack

Backend:

- NestJS
- TypeScript
- PostgreSQL
- Prisma
- Redis
- BullMQ
- Socket.IO
- Jest + Supertest

Frontend:

- Next.js App Router
- TypeScript
- Tailwind CSS
- TanStack Query
- Zustand
- Socket.IO client

DevOps:

- Docker Compose for local development
- GitHub Actions for CI
- Vercel for frontend deployment
- Railway, Render, Fly.io, or AWS for backend deployment
- Neon or Supabase for managed PostgreSQL
- Upstash Redis for managed Redis

## Repository Shape

Use a monorepo so the app feels like a real product.

```txt
devsync/
  apps/
    api/
      src/
      test/
    web/
      app/
      components/
      lib/
  packages/
    db/
      prisma/
      src/
    shared/
      src/
  docker-compose.yml
  package.json
  README.md
```

## Build Principles

- Build API-first, then connect the frontend.
- Keep each milestone shippable.
- Add tests around backend behavior as soon as the feature matters.
- Prefer one strong implementation over many shallow features.
- Treat the README, API docs, and demo data as part of the product.

## Milestone 0: Project Setup

Goal: create the technical foundation.

Build:

- Monorepo setup
- NestJS API app
- Next.js web app
- PostgreSQL Docker service
- Redis Docker service
- Prisma package
- Shared TypeScript package
- Environment variable structure
- Basic health endpoint

Learn:

- Monorepo organization
- Local development with Docker
- Environment separation
- Backend project structure

Done when:

- `api` starts locally.
- `web` starts locally.
- PostgreSQL and Redis run through Docker Compose.
- API can connect to the database.

## Milestone 1: Auth + User Foundation

Goal: build a real authentication system.

Build:

- User registration
- Login
- Logout
- Password hashing
- JWT access tokens
- Refresh token rotation
- Protected routes
- Current user endpoint
- Basic email verification placeholder
- Forgot-password placeholder

Database models:

- `User`
- `RefreshToken`
- `EmailVerificationToken`
- `PasswordResetToken`

API examples:

```txt
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
POST /auth/verify-email
POST /auth/forgot-password
POST /auth/reset-password
```

Learn:

- Authentication flow
- Secure password storage
- Token rotation
- Guards and decorators
- Request validation
- Auth testing

Done when:

- Users can register and log in.
- Protected routes reject anonymous requests.
- Refresh tokens can be rotated and revoked.
- Auth endpoints have integration tests.

## Milestone 2: Workspaces + RBAC

Goal: model multi-user SaaS access control.

Build:

- Create workspace
- List user workspaces
- Invite members by email
- Accept workspace invite
- Change member role
- Remove workspace member
- Role-based route protection

Roles:

- `OWNER`
- `ADMIN`
- `MEMBER`
- `VIEWER`

Database models:

- `Workspace`
- `WorkspaceMember`
- `WorkspaceInvite`

API examples:

```txt
POST /workspaces
GET  /workspaces
GET  /workspaces/:workspaceId
POST /workspaces/:workspaceId/invites
POST /workspaces/invites/:token/accept
PATCH /workspaces/:workspaceId/members/:memberId/role
DELETE /workspaces/:workspaceId/members/:memberId
```

Learn:

- Many-to-many relations
- Authorization guards
- Access scopes
- Multi-tenant data boundaries
- Permission testing

Done when:

- A user can own a workspace.
- Workspace members only see workspaces they belong to.
- Role checks are enforced server-side.
- Authorization tests cover allowed and denied actions.

## Milestone 3: Projects, Boards, and Tasks

Goal: build the core project management system.

Build:

- Projects inside workspaces
- Kanban boards
- Columns
- Tasks
- Task assignment
- Task status changes
- Task comments
- Activity log entries
- Cursor pagination for task lists
- Filtering and sorting

Database models:

- `Project`
- `Board`
- `BoardColumn`
- `Task`
- `TaskAssignee`
- `TaskComment`
- `ActivityLog`

API examples:

```txt
POST /workspaces/:workspaceId/projects
GET  /workspaces/:workspaceId/projects
POST /projects/:projectId/boards
GET  /boards/:boardId
POST /boards/:boardId/tasks
PATCH /tasks/:taskId
DELETE /tasks/:taskId
POST /tasks/:taskId/comments
GET  /tasks/:taskId/activity
```

Learn:

- Relational schema design
- Nested resource APIs
- Transactions
- Pagination
- Query optimization
- Audit trail design

Done when:

- Users can manage projects and tasks.
- Task updates are recorded in activity logs.
- Queries are paginated.
- Prisma migrations are clean and documented.

## Milestone 4: Frontend MVP

Goal: make the product usable.

Build:

- Login/register pages
- Workspace switcher
- Project list
- Board view
- Task details panel
- Comments UI
- Member management screen
- Protected frontend routes
- TanStack Query API layer

Learn:

- API integration
- Auth state management
- Query caching
- Optimistic updates
- App Router structure

Done when:

- A user can sign up, create a workspace, create a project, and manage tasks from the UI.
- The app feels like a usable product, not only an API demo.

## Milestone 5: Realtime Collaboration

Goal: make DevSync feel alive.

Build:

- Socket.IO gateway
- Workspace rooms
- Project rooms
- Live task updates
- Live comments
- Online member presence
- Typing indicators for comments
- Realtime notifications

Socket events:

```txt
workspace:join
workspace:leave
task:created
task:updated
task:moved
comment:created
presence:updated
notification:new
```

Learn:

- WebSocket authentication
- Rooms
- Event broadcasting
- Realtime state reconciliation
- Presence tracking with Redis

Done when:

- Two browser sessions see task and comment updates without refreshing.
- Online users are visible per workspace.
- Socket events are scoped to authorized users.

## Milestone 6: Redis, Caching, and Rate Limiting

Goal: add performance and abuse protection.

Build:

- Redis connection module
- Login rate limiting
- API request throttling
- Cached workspace summary
- Cached dashboard stats
- Cache invalidation after writes
- Redis-backed presence state

Learn:

- Cache-aside pattern
- TTLs
- Invalidation
- Rate limiting
- Redis data structures

Done when:

- Expensive dashboard queries are cached.
- Cache invalidates when relevant data changes.
- Login abuse is rate-limited.

## Milestone 7: Queues and Background Jobs

Goal: move slow work out of request-response flow.

Build:

- BullMQ queues
- Email queue
- Notification delivery queue
- Activity logging queue
- Scheduled cleanup job
- Failed job retries
- Worker process

Learn:

- Async processing
- Job retries
- Delayed jobs
- Worker separation
- Reliability tradeoffs

Done when:

- API requests enqueue background jobs.
- Workers process jobs separately.
- Failed jobs retry with backoff.

## Milestone 8: Search and Files

Goal: add practical SaaS features.

Build:

- PostgreSQL full-text search
- Search tasks, comments, and projects
- File upload endpoint
- S3-compatible or Cloudinary storage
- Task attachments
- Profile images

Learn:

- Full-text search
- Search ranking basics
- File validation
- Object storage
- Signed URLs

Done when:

- Users can search workspace content.
- Users can attach files to tasks.
- Files are stored outside the database.

## Milestone 9: Observability and Security

Goal: make the backend look production-aware.

Build:

- Pino or Winston logging
- Request ID middleware
- Global exception filter
- API timing logs
- Helmet
- CORS configuration
- Secure cookie settings
- Input validation
- SQL injection prevention through Prisma
- Optional Prometheus metrics endpoint

Learn:

- Structured logs
- Error handling
- Security hardening
- Operational debugging

Done when:

- Errors are consistently formatted.
- Requests have traceable IDs.
- Security middleware is enabled.
- Logs are useful while debugging.

## Milestone 10: Testing, Docs, and Deployment

Goal: make the project portfolio-ready.

Build:

- Unit tests for services
- Integration tests for API routes
- Auth and RBAC test coverage
- Seed script with realistic demo data
- OpenAPI documentation
- Docker Compose setup
- GitHub Actions CI
- Deployment docs
- Strong README

Learn:

- Test strategy
- CI basics
- Deployment architecture
- API documentation
- Portfolio storytelling

Done when:

- Tests run in CI.
- Demo data can be seeded.
- README explains the architecture clearly.
- A recruiter or engineer can run the app locally.

## Standout Features

Choose one or two after the core app is stable.

AI sprint planner:

- Summarizes unfinished work.
- Suggests sprint priorities.
- Converts vague goals into tasks.

AI task summarizer:

- Summarizes long comment threads.
- Extracts blockers and decisions.

Analytics dashboard:

- Shows task completion rate.
- Tracks overdue tasks.
- Shows member workload.

Webhook system:

- Lets external systems subscribe to project events.
- Teaches event contracts and retry logic.

API versioning:

- Adds `/v1` routes.
- Teaches backward compatibility.

## Suggested Database Model List

Core:

- `User`
- `RefreshToken`
- `Workspace`
- `WorkspaceMember`
- `WorkspaceInvite`
- `Project`
- `Board`
- `BoardColumn`
- `Task`
- `TaskAssignee`
- `TaskComment`
- `ActivityLog`
- `Notification`
- `Attachment`

Advanced:

- `EmailVerificationToken`
- `PasswordResetToken`
- `WebhookEndpoint`
- `WebhookDelivery`
- `AuditLog`
- `ApiKey`

## Suggested Learning Order

1. NestJS modules, controllers, services, providers
2. Prisma schema, migrations, and relations
3. Authentication and guards
4. RBAC and multi-tenancy
5. Transactions and activity logging
6. Pagination, filtering, and indexes
7. Socket.IO gateways
8. Redis caching and rate limiting
9. BullMQ queues and workers
10. Testing and deployment

## First Sprint

Build this first:

- Monorepo skeleton
- NestJS API
- Prisma setup
- PostgreSQL Docker service
- User model
- Auth register/login
- JWT guard
- `GET /auth/me`
- Integration tests for auth

This is the right first sprint because it creates the foundation everything else depends on.

## Portfolio Checklist

Before calling the project complete, make sure it has:

- Polished README
- Architecture diagram
- Database schema diagram
- API documentation
- Demo credentials
- Seed data
- Screenshots
- Deployed frontend
- Deployed backend
- Clear test instructions
- Clear local setup instructions
- Short demo video or GIF

## README Pitch

Use something like this at the top of the final README:

```md
# DevSync

DevSync is a realtime collaborative project management SaaS built with NestJS, PostgreSQL, Redis, Prisma, Socket.IO, BullMQ, and Next.js.

It supports multi-workspace collaboration, role-based access control, realtime task updates, comments, notifications, file attachments, full-text search, background jobs, and production-style observability.
```


# Milestone 7 Design Note — Queues and Background Jobs

> Implementation spec written so a capable model/developer can execute it
> **without re-deriving design decisions**. Depends on Milestone 6's
> `RedisModule` (shared `ioredis` client). Backend-only.

## 0. Conventions to follow (already in the repo)

- **Module shape:** mirror existing feature modules. Auth via `JwtAuthGuard`,
  tenant isolation rules unchanged (non-member → 404, wrong role → 403).
- **Config:** global `ConfigModule`; reuse `REDIS_URL` via `ConfigService`.
- **Emit-after-commit principle (carry over from M5/M6):** enqueue jobs **after**
  the DB transaction commits, in the same service methods that already emit
  realtime events and invalidate cache. Side-effects stay co-located.
- **Tests:** existing harness; the API and the **e2e suite must boot without a
  live Redis/worker**. See §6.

## 1. Goal and boundary

Move slow / fire-and-forget work off the request path: email sending,
notification delivery, activity logging, and scheduled cleanup. The HTTP request
**enqueues** and returns immediately; a **separate worker process** consumes.

Key decision: **the worker is a second entry point into the same Nest app**, not
a separate codebase. Reuse all existing modules/Prisma/Redis. Two processes,
one module graph.

## 2. Dependencies

Add to `apps/api`:

```
bullmq @nestjs/bullmq
```

BullMQ needs its own `ioredis` connection options with
`maxRetriesPerRequest: null` (BullMQ requirement) — so configure BullMQ's
connection from `REDIS_URL` separately from the M6 cache client (don't share the
exact client instance; share the URL/config).

## 3. Queue catalog (authoritative names + payloads)

Register via `BullModule.forRootAsync` (connection from config) once, then
`BullModule.registerQueue(...)` per queue. Define queue names and job payload
types in one file `apps/api/src/jobs/jobs.constants.ts` (importable by both
producers and the worker) to avoid drift.

| Queue name | Job | Payload | Producer |
|---|---|---|---|
| `email` | `send-email` | `{ to, template, data }` | auth (verify/reset), invites |
| `notifications` | `deliver` | `{ userId, type, taskId, title, projectId }` | `TasksService` (assignment) |
| `activity` | `record` | `{ workspaceId, projectId, taskId?, actorId, action, metadata }` | task/comment/project writes |
| `maintenance` | `cleanup-expired` | `{}` (repeatable/cron) | scheduler (see §5) |

### Activity logging via queue (design note)

Today activity rows are written **synchronously inside the same transaction** as
the mutation (see `TasksService.recordActivity`). Decision for M7: keep the
**critical** activity writes synchronous (they're cheap and you want them atomic
with the write), and use the `activity` queue only for **derived/expensive**
post-processing (e.g. fan-out, denormalized feeds) introduced here. Do **not**
rip out the transactional activity log — that would weaken M3's guarantees.
If the spec author wants async activity, it must be **at-least-once** and
tolerate duplicates; document that explicitly before changing it.

## 4. Producers (enqueue points)

Inject the relevant `Queue` (via `@InjectQueue('email')`, etc.) into existing
services. Enqueue **after commit**, next to the existing emit/invalidate calls:

- `AuthService`: verify-email / forgot-password → `email` queue (replaces the
  current placeholder send).
- `WorkspacesService.invite` → `email` queue with the invite token.
- `TasksService` assignment (the `notifyAssignees` path) → `notifications`
  queue **in addition to** the realtime `notification:new` emit (realtime is the
  live nudge; the queue is durable delivery).

Add jobs with sane options: `{ attempts: 3, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: 1000, removeOnFail: 5000 }`.

## 5. Scheduled / repeatable jobs

Use BullMQ repeatable jobs (cron) for `maintenance:cleanup-expired`:

- Delete expired `WorkspaceInvite` rows (`expiresAt < now`, not accepted).
- Prune stale refresh tokens / revoked sessions if applicable.
- (Optional) prune old `ActivityLog` beyond a retention window.

Register the repeatable job on worker bootstrap (e.g. every 10 min) — guard
against duplicate registration (BullMQ dedupes by repeat key, but only register
in the worker process, not the API).

## 6. Worker process (separation)

Create `apps/api/src/worker.ts` — a second bootstrap that creates the Nest
**application context** (`NestFactory.createApplicationContext(AppModule)`),
not an HTTP server. Processors are NestJS `@Processor('queue')` classes
(`apps/api/src/jobs/processors/*.processor.ts`) registered in a `JobsModule`.

- Add npm scripts: `dev:worker` (ts-node/nest start with worker entry) and
  `start:worker` (run compiled `dist/worker.js`).
- Processors do the real work: `EmailProcessor` (call the mailer — a real
  provider is later; for now a logging/no-op transport behind an interface),
  `NotificationProcessor`, `ActivityProcessor`, `MaintenanceProcessor`.
- **Failure handling:** rely on `attempts` + exponential backoff. Log on
  `failed`/`completed` events. A job that exhausts retries lands in the failed
  set (`removeOnFail` retention) for inspection — that's the dead-letter story
  for this milestone.
- **Idempotency:** processors must tolerate re-runs (at-least-once delivery).
  E.g. use job id / natural keys so a retried email/notification isn't harmful.

### Test-environment rule (important)

- `JobsModule` registration must not require a live Redis to *instantiate* the
  API for e2e. Gate queue registration / use a mock queue when `NODE_ENV === "test"`,
  **or** assert enqueue calls against an injected queue token that's stubbed.
- Keep the existing 48 e2e green. Add a focused test that a mutation **enqueues**
  the expected job (assert on a mocked `Queue.add`), rather than spinning a real
  worker in CI.

## 7. Done-when checklist

- [ ] `bullmq` + `@nestjs/bullmq` wired; connection from `REDIS_URL` (with `maxRetriesPerRequest: null`).
- [ ] Queue names + payload types centralized in `jobs.constants.ts`.
- [ ] Producers enqueue **after commit** at the documented points.
- [ ] Separate worker entry (`worker.ts`) runs processors via app context; `dev:worker` / `start:worker` scripts exist.
- [ ] Jobs retry with exponential backoff; failures retained for inspection.
- [ ] Repeatable cleanup job registered (worker only).
- [ ] Transactional M3 activity log left intact (or async change justified + idempotent).
- [ ] API + e2e boot without a live worker/Redis; enqueue asserted via stub; all green.
- [ ] `npx tsc -p apps/api/tsconfig.json --noEmit` clean; README updated (queues + worker run instructions).

## 8. Out of scope (later milestones)

- Real email provider integration (SES/Resend/etc.) — interface now, provider later.
- Notification persistence/read-state model — later.
- Multi-node Socket.IO fan-out — **M9**.

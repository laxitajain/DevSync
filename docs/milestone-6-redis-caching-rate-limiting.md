# Milestone 6 Design Note — Redis, Caching, Rate Limiting

> Implementation spec written so a capable model/developer can execute it
> **without re-deriving design decisions**. Follow the patterns already in
> Milestones 1–5. Backend-only milestone (no required web changes, but the web
> client must keep working unchanged).

## 0. Conventions to follow (already in the repo)

- **Module shape:** mirror `apps/api/src/workspaces/` and `apps/api/src/realtime/`.
- **Auth:** routes behind `JwtAuthGuard`; `request.user` is `{ sub, email }`.
- **Tenant isolation (unchanged):** non-member → 404, wrong role → 403. Reuse
  `WorkspaceAccessService` for flat resolution and `WorkspaceRolesGuard` +
  `@Roles(...)` for `:workspaceId` routes.
- **Config:** `ConfigModule` is global. `REDIS_URL` already exists in `.env`
  (default `redis://localhost:6379`). Read secrets via `ConfigService`.
- **Tests:** add `*.e2e-spec.ts` using the existing harness
  (`test/utils/test-app.ts`, `resetDatabase`, `registerUser`, `bearer`). Run
  against `devsync_test`. **The test app must not require a live Redis to boot**
  — see §6.

## 1. Dependencies

Add to `apps/api`:

```
ioredis @nestjs/throttler @nestjs/cache-manager cache-manager cache-manager-ioredis-yet
```

(If `cache-manager-ioredis-yet` causes version friction, fall back to a hand-rolled
cache service on top of `ioredis` — see §3 note. Do not invent versions; install latest.)

## 2. Redis connection module (do this first)

Create `apps/api/src/redis/redis.module.ts` (`@Global`) exposing a single shared
`ioredis` client as an injectable provider. One connection reused everywhere
(cache, rate limit store, presence). Mirror how `RealtimeModule` is `@Global`.

```ts
export const REDIS_CLIENT = "REDIS_CLIENT";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const client = new Redis(config.get<string>("REDIS_URL", "redis://localhost:6379"), {
          maxRetriesPerRequest: 2,
          lazyConnect: false,
          // Don't crash the app if Redis is briefly unavailable.
          enableOfflineQueue: true
        });
        client.on("error", (err) => new Logger("Redis").error(err.message));
        return client;
      }
    }
  ],
  exports: [REDIS_CLIENT]
})
export class RedisModule {}
```

Register `RedisModule` early in `AppModule` (right after `ConfigModule`, before
the others that depend on it). Add graceful shutdown: `app.enableShutdownHooks()`
in `main.ts` if not already present, and `quit()` the client `onModuleDestroy`.

## 3. Cache service (cache-aside)

Create `apps/api/src/cache/cache.service.ts` wrapping the Redis client. Keep the
surface tiny and explicit — **prefer this over magic interceptors** so invalidation
points are visible in the domain code.

```ts
@Injectable()
export class CacheService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> { /* JSON.parse, null on miss/parse error */ }
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> { /* SET key json EX ttl */ }
  async del(...keys: string[]): Promise<void> { if (keys.length) await this.redis.del(...keys); }
  // Helper for invalidation by pattern (use SCAN, never KEYS in prod path).
  async delByPrefix(prefix: string): Promise<void> { /* SCAN MATCH prefix* then del in batches */ }

  // Convenience: get-or-load.
  async remember<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== null) return hit;
    const value = await loader();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}
```

**Resilience rule:** every cache read/write is best-effort. If Redis throws,
log and fall through to the database. A cache outage must degrade to "slower",
never "down". Wrap `get`/`set` bodies in try/catch returning `null`/`void`.

### Key scheme (authoritative — do not improvise)

| Concern | Key | TTL |
|---|---|---|
| Workspace summary | `ws:summary:{workspaceId}` | 60s |
| Dashboard stats | `ws:dashboard:{workspaceId}` | 30s |

All workspace-scoped cache keys are prefixed `ws:*:{workspaceId}` so a single
write can invalidate everything for that workspace via
`delByPrefix("ws:")`-style scoping if needed. Prefer **targeted** deletes
(known keys) over prefix scans.

## 4. New cached read endpoints

These are new endpoints (none exist yet). Both behind `JwtAuthGuard` and
membership-checked via `WorkspaceAccessService.requireMembership`.

- `GET /api/workspaces/:workspaceId/summary` → `{ projectCount, memberCount, openTaskCount }`.
  Cache under `ws:summary:{workspaceId}` (60s) via `cache.remember`.
- `GET /api/workspaces/:workspaceId/dashboard` → heavier aggregate, e.g.
  `{ tasksByPriority, tasksByColumn, recentActivityCount }`. Cache under
  `ws:dashboard:{workspaceId}` (30s).

Put these on `WorkspacesController` (or a small `DashboardController` in the
workspaces module). Compute the aggregates with Prisma `groupBy`/`count`.

## 5. Cache invalidation (the part to get right)

Invalidate **after the DB transaction commits**, in the same services that emit
realtime events (so the two side-effects sit together). Inject `CacheService`.

Invalidate `ws:summary:{workspaceId}` and `ws:dashboard:{workspaceId}` on:

- Project create/delete → `ProjectsService`.
- Task create / update / move / delete → `TasksService` (you already added emit
  points there in M5; add `cache.del(...)` right next to each emit).
- Member add (invite accept) / remove / role change → `WorkspacesService`.

To resolve `workspaceId` in flat task routes, you already load it
(`task.project.workspaceId`) — reuse it. **Rule: any write that changes a count
or aggregate the cached endpoints return must invalidate both keys for that
workspace.** When unsure, invalidate (correctness > hit rate).

E2E must prove: read (miss→cached), write, read again returns fresh data.

## 6. Rate limiting / throttling

Use `@nestjs/throttler` with a Redis storage adapter so limits hold across
multiple API instances (M9 scaling).

- Global default throttle (e.g. 100 req / 60s per IP) registered in `AppModule`
  via `ThrottlerModule.forRootAsync` with the Redis storage. Apply
  `ThrottlerGuard` as a global guard (`APP_GUARD`).
- **Stricter named limit on login**: `@Throttle({ default: { limit: 5, ttl: 60_000 } })`
  on `POST /auth/login` (and `/auth/register`, `/auth/forgot-password`). Key by
  IP + email if feasible; IP alone is acceptable for this milestone.
- Throttled requests return **429** with a clear message via the existing
  `HttpExceptionFilter` shape.

### Test-environment rule (important)

The e2e harness must boot without a real Redis and must not flake from
throttling. Do **one** of:

1. Gate the Redis storage + throttler behind `NODE_ENV !== "test"` (use the
   default in-memory throttler store in tests), **or**
2. Set the login limit high in test config.

Prefer option 1. Document the choice in the throttler factory. Keep the existing
48 e2e tests green; add a dedicated rate-limit test that runs against the
in-memory store with a low limit (or skips when no Redis).

## 7. Redis-backed presence (migrate M5 in-memory presence)

Today presence lives in `RealtimeGateway` as an in-memory `Map<workspaceId,
Map<userId, count>>`. Move the **state** to Redis so it survives multiple API
instances; keep the **event contract identical**.

- Storage: per workspace, a Redis hash `presence:ws:{workspaceId}` field
  `{userId}` = integer socket count. On join `HINCRBY +1`; on
  leave/disconnect `HINCRBY -1` and `HDEL` when it hits 0. Add a TTL/refresh or
  a periodic reaper so a crashed instance can't leak presence forever (e.g.
  expire the hash and re-populate on activity, or store `lastSeen` and prune).
- Online list = `HKEYS presence:ws:{workspaceId}`.
- **Contract unchanged:** still emit `presence:updated { workspaceId,
  onlineUserIds }` to the workspace room exactly as in M5. The web client
  (`useWorkspacePresence` / `useBoardRealtime`) must require **zero** changes.
- Multi-instance correctness (cross-instance fan-out of socket emits) is the
  **M9** Redis Socket.IO adapter concern — do **not** pull that forward. M6 only
  moves presence *state* to Redis.

## 8. Done-when checklist

- [ ] `RedisModule` provides one shared client; app boots and shuts down cleanly.
- [ ] `GET .../summary` and `.../dashboard` are cache-aside (miss loads + caches, hit skips DB).
- [ ] Relevant writes invalidate both workspace cache keys; e2e proves freshness.
- [ ] Global throttle active; `/auth/login` strictly limited; returns 429.
- [ ] Presence state lives in Redis; `presence:updated` contract unchanged; web untouched.
- [ ] Cache/throttle failures degrade gracefully (no Redis in tests still boots).
- [ ] `npx tsc -p apps/api/tsconfig.json --noEmit` clean; all e2e green; README updated.

## 9. Out of scope (later milestones)

- Socket.IO Redis adapter / multi-node event fan-out → **M9**.
- BullMQ queues / async jobs → **M7**.
- Full notification persistence → later.

# Deployment Guide

DevSync is a monorepo with three runnable processes plus three backing
services. This guide covers running it locally and deploying it to a typical
container host.

## Architecture at a glance

```
                       ┌────────────┐
            HTTP/WS    │  Next.js   │
  Browser ───────────▶ │  web app   │
                       └─────┬──────┘
                             │ REST + Socket.IO
                       ┌─────▼──────┐      ┌───────────┐
                       │  NestJS    │◀────▶│ PostgreSQL│
                       │  API       │      └───────────┘
                       │ (HTTP+WS)  │      ┌───────────┐
                       └─────┬──────┘◀────▶│   Redis   │ (cache, throttle,
                             │ enqueue     └───────────┘  presence, queues)
                       ┌─────▼──────┐      ┌───────────┐
                       │  Worker    │◀────▶│  MinIO/S3 │ (attachments,
                       │ (BullMQ)   │      └───────────┘  avatars)
                       └────────────┘
```

| Process | Entry point | Scales | Notes |
| --- | --- | --- | --- |
| API | `apps/api/dist/main.js` | horizontally | Stateless; HTTP + Socket.IO gateway |
| Worker | `apps/api/dist/worker.js` | horizontally | BullMQ consumers (email, notifications, activity, maintenance cron) |
| Web | `apps/web` (Next.js) | horizontally | Talks to API over `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` |

The API and Worker share the **same image** — the worker is just a second
entry point into the same Nest application.

## Backing services

| Service | Local (docker-compose) | Production |
| --- | --- | --- |
| PostgreSQL 16 | `postgres` service | Managed (RDS, Cloud SQL, Neon, …) |
| Redis 7 | `redis` service | Managed (ElastiCache, Upstash, …) |
| Object storage | `minio` service (S3-compatible) | S3, R2, or any S3-compatible store |

## Environment variables

Copy `.env.example` to `.env` and fill in real values. Required by the API and
Worker:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (include `?schema=public`) |
| `REDIS_URL` | Redis connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing secrets (use long random values) |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Token lifetimes |
| `PORT` | API listen port (default 4000) |
| `WEB_ORIGIN` | Allowed CORS origin for the web app |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` | Object storage location |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Object storage credentials |
| `S3_FORCE_PATH_STYLE` | `true` for MinIO; usually `false` for AWS S3 |
| `LOG_LEVEL` | Optional Pino level override (`info`, `debug`, …) |

The web app needs `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` at build time.

## Run locally (without containers)

```bash
docker compose up -d            # postgres, redis, minio
cp .env.example .env
npm install
npm run db:generate
npm run db:deploy               # apply migrations
npm run db:seed                 # optional: realistic demo data
npm run dev:api                 # API on :4000
npm run dev:worker              # background worker (separate terminal)
npm run dev:web                 # web on :3000
```

Demo login after seeding: `olivia@devsync.dev` / `Password123!`

## Run the API/Worker as containers

```bash
docker build -t devsync-api .

# API
docker run --rm -p 4000:4000 --env-file .env devsync-api

# Worker (same image, different command)
docker run --rm --env-file .env devsync-api node apps/api/dist/worker.js
```

Point `DATABASE_URL` / `REDIS_URL` / `S3_*` at reachable services (use
`host.docker.internal` instead of `localhost` when talking to host services
from inside a container).

## Database migrations on deploy

Migrations are applied with `prisma migrate deploy` — the same command used by
CI and the e2e harness. Run it as a release/pre-deploy step:

```bash
npm run db:deploy        # = prisma migrate deploy (idempotent)
```

Never run `prisma migrate dev` against production.

## Health, metrics, and docs

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Liveness/readiness probe |
| `GET /metrics` | Prometheus scrape target (default process + HTTP metrics) |
| `GET /api/docs` | Swagger UI (OpenAPI) |

Every response carries an `X-Request-Id` header; the same id appears on the
matching structured log line and in error response bodies.

## CI

`.github/workflows/ci.yml` spins up Postgres + Redis service containers and
runs: install → Prisma generate → build shared db package → API typecheck →
unit tests → e2e tests → API build. CI must be green before merge.

## Deployment targets

- **API + Worker**: any container platform (Fly.io, Render, ECS, Cloud Run,
  Kubernetes). Run at least one API replica and one worker replica.
- **Web**: Vercel (native Next.js) or a Node container running `next build` +
  `next start`.
- **Postgres / Redis / object storage**: use managed equivalents in production.

# syntax=docker/dockerfile:1

# Multi-stage build for the DevSync API (and worker — same image, different
# CMD). Build context is the repo root so the monorepo workspaces resolve.
#
#   docker build -t devsync-api .
#   docker run -p 4000:4000 --env-file .env devsync-api                 # API
#   docker run --env-file .env devsync-api node apps/api/dist/worker.js  # worker

FROM node:20-bookworm-slim AS base
WORKDIR /app
# Prisma's query engine needs OpenSSL at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# --- Install dependencies (cached on lockfile/manifests) ---
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

# --- Build the db package, generate the Prisma client, build the API ---
FROM deps AS build
COPY . .
RUN npm run db:generate \
  && npm run build --workspace @devsync/db \
  && npm run build --workspace @devsync/api

# --- Runtime image ---
FROM base AS runner
ENV NODE_ENV=production
# node_modules carries the generated Prisma client + engine, so we copy it whole.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY --from=build /app/packages/db/package.json ./packages/db/package.json
COPY --from=build /app/packages/db/prisma ./packages/db/prisma

EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]

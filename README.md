# DevSync

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=next.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat-square&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)

DevSync is a highly scalable, real-time collaborative project management platform. Designed with a robust microservice-inspired architecture within a monorepo, it demonstrates production-grade engineering patterns including multi-tenant isolation, real-time WebSocket state synchronization, asynchronous background processing, and object storage integration.

## Key Features

- **Real-Time Collaboration**: Live task updates, comment typing indicators, and presence tracking powered by an authenticated Socket.IO gateway.
- **Multi-Tenant Architecture**: Strict workspace isolation with hierarchical Role-Based Access Control (RBAC).
- **Background Processing**: Reliable asynchronous job queues for email delivery and data cleanup utilizing BullMQ and Redis.
- **Advanced Search Engine**: Full-text search across tasks, comments, and projects utilizing PostgreSQL `ts_rank` and `websearch_to_tsquery`.
- **Object Storage**: S3-compatible streaming for task attachments and profile avatars with signed short-lived URLs.
- **Enterprise Observability**: Structured JSON logging (Pino), request ID propagation, global error shaping, and Prometheus metric scraping.
- **Security First**: Parameterized queries, explicit CORS, Helmet headers, Argon2 password hashing, and strict input validation pipelines.

## Tech Stack

### Backend
- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL with Prisma ORM
- **Cache & Message Broker**: Redis & BullMQ
- **Real-Time**: Socket.IO
- **Storage**: S3-compatible Object Storage (MinIO, AWS S3, Cloudflare R2)

### Frontend
- **Framework**: Next.js (React)
- **State Management**: TanStack Query (Server State), Zustand (Client State)
- **Styling**: Tailwind CSS

## Architecture Overview

The repository is structured as a TypeScript monorepo containing three primary deployable services:

1. **REST API Gateway**: Handles HTTP requests, authentication, and database transactions.
2. **WebSocket Server**: Runs concurrently with the API to broadcast real-time state mutations.
3. **Background Worker**: A detached Node.js process dedicated to consuming and processing BullMQ queues.

## Local Development Environment

### Prerequisites
- Node.js (v20+)
- Docker & Docker Compose

### Setup

1. **Configure Environment Variables**
   ```sh
   cp .env.example .env
   cp packages/db/.env.example packages/db/.env
   ```

2. **Provision Infrastructure**
   Start the local PostgreSQL, Redis, and MinIO instances.
   ```sh
   docker compose up -d
   ```

3. **Install Dependencies & Run Migrations**
   ```sh
   npm install
   npm run db:generate
   npm run db:deploy
   npm run db:seed
   ```
   *(Demo credentials: `olivia@devsync.dev` / `Password123!`)*

4. **Start Services**
   Open separate terminal windows for each service:
   ```sh
   npm run dev:api     # Starts the NestJS API & WebSocket Gateway
   npm run dev:worker  # Starts the BullMQ Background Worker
   npm run dev:web     # Starts the Next.js Frontend
   ```

## Testing

The project maintains comprehensive test coverage for core business logic and database integration.

```sh
npm run test        # Unit tests (RBAC, cursors, token hashing)
npm run test:e2e    # Integration tests against a dedicated Postgres test schema
```

## Deployment

The application is containerized using a multi-stage Docker build, optimizing for production artifact size. The single Docker image serves as the execution environment for both the API and Worker processes.

Refer to `docs/deployment.md` for detailed production deployment guides, environment variable references, and architectural diagrams.

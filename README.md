# Omniflow

Omniflow is a modular, enterprise-grade ERP platform: multi-company,
multi-branch, multi-user, with role-based access control, a REST + GraphQL
API, a plugin system, and a growing set of business modules (CRM, Sales,
Inventory, Accounting, HR, Projects, and more).

> **Build status.** Omniflow is being built incrementally, milestone by
> milestone, with a checkpoint after each. See [Milestones](#milestones)
> below for what's done and what's next.

## Tech stack

| Layer          | Choice                                                         |
| -------------- | ---------------------------------------------------------------|
| Frontend       | React, Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend        | Node.js, NestJS (REST + GraphQL)                                |
| Database       | PostgreSQL (via Prisma)                                         |
| Caching        | Redis                                                            |
| Object storage | S3-compatible (MinIO locally, AWS S3 in production)              |
| Realtime       | Socket.IO                                                        |
| Search         | Elasticsearch                                                    |
| Auth           | JWT (access + refresh), OAuth, TOTP 2FA                          |
| Payments       | Stripe, PayPal, M-Pesa                                           |
| Containers     | Docker, Kubernetes                                               |

## Repository layout

```
omniflow/
  apps/
    web/        Next.js frontend (App Router, Tailwind, shadcn/ui)
    api/        NestJS backend (REST + GraphQL, modular monolith, microservice-ready)
    worker/     Background job processor (added in Milestone 6)
  packages/
    database/   Prisma schema, migrations, seed scripts — shared by api/worker
    shared/     Shared TypeScript types, DTOs, constants (used by api + web)
    ui/         Shared shadcn/ui-based component library (used by web)
    config/     Shared ESLint/TypeScript configs
  infra/
    docker/     Dockerfiles for api/web
    k8s/        Kubernetes manifests (base + environment overlays)
    nginx/      Reverse proxy config for single-host Docker Compose deploys
  docs/         Architecture, database, API, installation, deployment, user & admin manuals
  scripts/      Operational scripts (backups, seeding, releases)
```

This is a pnpm workspace managed with Turborepo — every app/package has its
own `package.json`, and shared tooling lives in `packages/config`.

## Milestones

Built and reviewed one at a time, in this order:

- [x] **1. Folder structure & tooling** — monorepo layout, bootable Next.js
      + NestJS skeletons, Docker Compose for local infra, CI pipeline.
- [x] **2. Database schema** — fully normalized PostgreSQL schema
      (multi-company/branch, users, RBAC, audit logs, sessions,
      notifications, files/attachments, comments), migrations, indexes,
      views, triggers, a stored procedure, and seed data. See
      [docs/database](docs/database/README.md).
- [ ] **3. Authentication** — JWT access/refresh tokens, TOTP 2FA, session
      management, password policy, rate limiting, OAuth.
- [ ] **4. User management & RBAC** — user CRUD, role/permission matrix,
      company/branch scoping, guards.
- [ ] **5. Dashboard** — sidebar/topbar shell, widgets, dark/light theme.
- [ ] **6. Core framework** — GraphQL, Swagger, audit logging,
      notifications, realtime (Socket.IO), plugin system, file storage,
      job queue/worker, security middleware, Kubernetes manifests.
- [ ] **7+. Business modules** — CRM, Sales, Inventory, Accounting, HR,
      Projects, and the rest, added one at a time.

## Getting started (local development)

Prerequisites: Node.js 20+, pnpm 9+, Docker (for Postgres/Redis/
Elasticsearch/MinIO).

```bash
# 1. Install dependencies
pnpm install

# 2. Start infra (Postgres, Redis, Elasticsearch, MinIO)
docker compose up postgres redis elasticsearch minio -d

# 3. Configure env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp packages/database/.env.example packages/database/.env

# 4. Apply migrations and seed demo data
pnpm db:migrate
pnpm db:seed

# 5. Run the apps
pnpm dev
```

- API: http://localhost:4000/api/v1 (Swagger docs at `/api/docs`)
- Web: http://localhost:3000

Seeded demo login: company slug `omniflow-demo`, email
`admin@omniflow-demo.com`, password `Admin@12345` (login itself lands in
Milestone 3 — Authentication).

## Running with Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

## Testing

```bash
pnpm test        # unit tests, all apps/packages
pnpm test:e2e     # end-to-end tests (api)
```

## Documentation

See [docs/](docs/) for architecture, database, API, installation,
deployment, and user/admin manuals — expanded alongside each milestone.

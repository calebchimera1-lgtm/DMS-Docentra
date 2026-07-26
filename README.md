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
    worker/     Background job processor (BullMQ/Redis) — session cleanup, webhook delivery
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
- [x] **3. Authentication** — JWT access/refresh tokens (rotation on
      refresh), TOTP 2FA with backup codes, session/device management,
      password policy + account lockout, rate limiting, an optional
      Google OAuth flow. See [docs/api](docs/api/README.md#authentication).
- [x] **4. User management & RBAC** — user CRUD, custom roles with a
      permission matrix, branch CRUD + user/branch/role assignment, a
      global `PermissionsGuard` enforcing it all, strict tenant
      isolation. See [docs/api](docs/api/README.md#user-management--rbac).
- [x] **5. Dashboard** — a real, working web app: login (with MFA), a
      responsive sidebar/topbar shell (mobile drawer nav), dark/light
      theme, and a dashboard home with live stat tiles, an activity
      chart, and a recent-activity feed pulled from the API. See
      [docs/architecture](docs/architecture/README.md#frontend-appsweb-added-in-milestone-5).
- [x] **6. Core framework** — a code-first GraphQL API alongside REST,
      Swagger docs, a global audit-log interceptor, notifications with a
      JWT-authenticated Socket.IO gateway, S3-compatible file storage &
      attachments, a DB-backed plugin system with an event-bridge to a
      BullMQ job queue, a standalone `apps/worker` consumer, and hardened
      security middleware (helmet, compression, GraphQL-aware rate
      limiting). Kubernetes manifests (base + production overlay) round
      out deployment. See [docs/api](docs/api/README.md#core-framework-milestone-6)
      and [docs/deployment](docs/deployment/README.md).
- [ ] **7+. Business modules** — CRM, Sales, Inventory, Accounting, HR,
      Projects, and the rest, added one at a time.
      - [x] **CRM** — accounts, contacts, leads (with lead → account/
            contact conversion), and deals moving through a sales
            pipeline. Full CRUD + GraphQL, search/filters, CSV export,
            pipeline/funnel reports, RBAC, audit logging, and comments/
            attachments on every record. See
            [docs/api](docs/api/README.md#crm-milestone-7--first-business-module).
      - [x] **Sales** — a products catalog and a quote → sales order →
            invoice conversion chain, each stage gated by status
            (accepted quotes only, one conversion each) with a
            JSON line-item snapshot so historical documents never
            drift if a product is later repriced. Full CRUD + GraphQL,
            CSV export, revenue reports, RBAC, audit logging. See
            [docs/api](docs/api/README.md#sales-milestone-7b--second-business-module).
      - [x] **Inventory** — warehouses, per-warehouse stock levels, and
            an append-only movement ledger (receipts, sales,
            adjustments, transfers, returns). Every stock change is
            recorded transactionally alongside the movement that
            caused it, with overselling prevented at the database
            transaction level. Full CRUD + GraphQL, low-stock
            filtering, CSV export, stock-value reports, RBAC, audit
            logging. See
            [docs/api](docs/api/README.md#inventory-milestone-7c--third-business-module).
      - [x] **Accounting** — a chart of accounts, double-entry journal
            entries (rejecting unbalanced entries and unbalanced/
            malformed lines before anything is written, immutable
            once posted), and payments that atomically post a journal
            entry and can settle a Sales invoice. Full CRUD + GraphQL,
            P&L/balance reports, CSV export, RBAC, audit logging. See
            [docs/api](docs/api/README.md#accounting-milestone-7d--fourth-business-module).
      - [x] **HR** — departments, employees (with a manager
            self-relation and an optional link to a system `User`),
            and a leave-request approval workflow that resolves the
            calling user to their own employee profile before letting
            them approve or reject. Full CRUD + GraphQL, headcount
            reports, CSV export, RBAC, audit logging. See
            [docs/api](docs/api/README.md#hr-milestone-7e--fifth-business-module).
      - [x] **Projects** — projects (optionally tied to a CRM account),
            tasks with status/priority/assignee, and time entries
            logged as minutes against a task, editable only by the
            user who logged them. Full CRUD + GraphQL, task-status
            reports, CSV export, RBAC, audit logging. See
            [docs/api](docs/api/README.md#projects-milestone-7f--sixth-business-module).
      - [x] **Support** — helpdesk tickets with an
            assign/resolve/close/reopen workflow, reusing the generic
            Comments/Attachments system from Milestone 7a for replies
            and files instead of duplicating it. Full CRUD + GraphQL,
            open/unassigned/overdue reports, CSV export, RBAC, audit
            logging. See
            [docs/api](docs/api/README.md#support-milestone-7g--seventh-business-module).
      - [x] **Purchase** — suppliers, purchase orders
            (DRAFT→SENT→CONFIRMED→RECEIVED), and a receiving action
            that transactionally posts Inventory stock movements —
            the buy-side counterpart to Sales, reusing its line-item
            and document-numbering utilities outright. Full CRUD +
            GraphQL, committed-spend reports, CSV export, RBAC, audit
            logging. See
            [docs/api](docs/api/README.md#purchase-milestone-7h--eighth-business-module).
      - [x] **Payroll** — a salary component catalog (earnings/
            deductions, fixed or percentage-based), pay runs with a
            `generate` action that computes every eligible employee's
            payslip from HR's existing salary data, and a `mark-paid`
            action. Full CRUD + GraphQL, payslip-status reports, CSV
            export, RBAC, audit logging. See
            [docs/api](docs/api/README.md#payroll-milestone-7i--ninth-business-module).
      - [ ] The rest.

## Getting started (local development)

Prerequisites: Node.js 20+, pnpm 9+, Docker (for Postgres/Redis/
Elasticsearch/MinIO). Redis must be running for the API to boot — the
job queue (BullMQ) connects to it at startup.

```bash
# 1. Install dependencies
pnpm install

# 2. Start infra (Postgres, Redis, Elasticsearch, MinIO)
docker compose up postgres redis elasticsearch minio -d

# 3. Configure env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/worker/.env.example apps/worker/.env
cp packages/database/.env.example packages/database/.env

# 4. Apply migrations and seed demo data
pnpm db:migrate
pnpm db:seed

# 5. Run the apps (web, api, and worker together)
pnpm dev
```

- API: http://localhost:4000/api/v1 (Swagger docs at `/api/docs`,
  GraphQL at `/api/v1/graphql`)
- Web: http://localhost:3000 — sign in at `/login` and land on the dashboard
- Worker: no HTTP surface — runs in the background processing queued
  jobs (session cleanup, webhook delivery); logs to stdout

Seeded demo login: company slug `omniflow-demo`, email
`admin@omniflow-demo.com`, password `Admin@12345` — or register your own
company from the API directly via `POST /auth/register` (there's no
sign-up page in the web app yet; see
[docs/api](docs/api/README.md#authentication)).

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

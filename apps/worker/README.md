# @omniflow/worker

Background job processor — a separate NestJS process (no HTTP server)
sharing `@omniflow/database` and `@omniflow/shared` with `apps/api`, so it
can be deployed and scaled independently (microservice-ready). `apps/api`
enqueues jobs onto Redis-backed BullMQ queues; this app consumes them.

## What it processes today

- **`maintenance` queue** — `cleanup-expired-sessions`, a daily
  repeatable job (scheduled by `apps/api`'s `JobsService` on boot) that
  deletes sessions expired/revoked more than 30 days ago.
- **`webhooks` queue** — `deliver-webhook`, an on-demand job the plugin
  system's event bridge enqueues (see `apps/api/src/modules/plugins`)
  whenever a company has the `webhook-notifier` plugin enabled for an
  event. Retries with exponential backoff (configured when the job is
  enqueued) since third-party endpoints are unreliable.

Queue/job names live in `packages/shared/src/constants/jobs.ts` — the
contract between producer (`apps/api`) and consumer (this app).

## Local development

```bash
cp .env.example .env
pnpm dev
```

Requires Postgres and Redis running (see the root `docker-compose.yml`).

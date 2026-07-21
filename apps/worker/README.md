# @omniflow/worker

Background job processor (queued emails, report generation, scheduled
exports, webhook delivery, backups) — a separate NestJS process sharing
`@omniflow/database` and `@omniflow/shared`, so it can be deployed and
scaled independently of the API (microservice-ready).

Scaffolded in Milestone 6 (Core framework), once the job queue
infrastructure (Redis/BullMQ) is wired up.

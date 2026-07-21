# API documentation

The REST API is self-documented via OpenAPI/Swagger, served at
`/api/docs` by `apps/api` (see `apps/api/src/main.ts`). This directory
holds supplementary reference material as it's needed — starting with
authentication, added in Milestone 3.

## Authentication

Source: `apps/api/src/modules/auth/`.

### Tokens & sessions

- **Access tokens** are short-lived JWTs (`JWT_ACCESS_EXPIRES_IN`,
  default 15m) carrying `{ sub, companyId, email, sessionId }`, signed
  with `JWT_ACCESS_SECRET`. Every route requires one by default — the
  global `JwtAuthGuard` (`apps/api/src/common/guards/jwt-auth.guard.ts`)
  is registered as an `APP_GUARD`, and routes opt out with `@Public()`.
- **Refresh tokens** are longer-lived JWTs (`JWT_REFRESH_EXPIRES_IN`,
  default 7d) carrying `{ sub, sessionId }`, signed with a *different*
  secret (`JWT_REFRESH_SECRET`) so a leaked access token can't be replayed
  as a refresh token. `POST /auth/refresh` **rotates** the session: the
  old session is revoked and a new one issued, so a stolen refresh token
  only works once before the legitimate client's next refresh invalidates
  it.
- Refresh tokens are stored hashed (SHA-256, not bcrypt — they're
  high-entropy random tokens, not low-entropy passwords, so a fast hash
  is appropriate and lets `Session` lookups stay O(1) instead of
  bcrypt-comparing against every row) in the `sessions` table alongside
  device/IP metadata, `GET /auth/sessions` lists a user's active
  sessions, and `DELETE /auth/sessions/:id` revokes one (device/session
  management, e.g. "sign out a lost laptop").
- **Logout is immediate, not just for future refreshes**: the access
  token strategy (`jwt-access.strategy.ts`) checks the referenced
  session's `revokedAt`/`expiresAt` on every request, so revoking a
  session (via logout or an admin action) blocks that session's existing
  access token right away rather than waiting up to 15 minutes for it to
  expire naturally.

### Passwords & lockout

- Hashed with bcrypt (12 rounds). Policy (`is-strong-password.validator.ts`):
  12+ characters, at least one uppercase, one lowercase, one digit, one
  symbol.
- 5 consecutive failed attempts locks the account for 15 minutes
  (`User.failedLoginAttempts` / `lockedUntil`); a successful login resets
  the counter.
- `POST /auth/password/forgot` always returns 200 regardless of whether
  the email exists (avoids account enumeration) and creates a
  `PasswordResetToken` (1 hour expiry, single use). Email delivery lands
  in Milestone 6 (Email integration) — until then, the raw token is
  logged and returned in the response body outside `NODE_ENV=production`
  so the flow is testable end-to-end.
- `POST /auth/password/reset` revokes **all** of the user's sessions as
  a side effect, on the assumption that a password reset often follows a
  suspected compromise.

### Two-factor authentication (TOTP)

- `POST /auth/mfa/setup` generates a TOTP secret (stored AES-256-GCM
  encrypted via `CryptoService`, not plaintext) and returns an `otpauth://`
  URL plus a QR code data URL to scan.
- `POST /auth/mfa/setup/confirm` verifies a code against the pending
  secret, flips `mfaEnabled`, and returns 10 one-time backup recovery
  codes (bcrypt-hashed at rest, each usable once).
- Once enabled, `POST /auth/login` returns `{ mfaRequired: true, mfaToken }`
  instead of tokens — `mfaToken` is a 5-minute JWT scoped to that single
  purpose (`purpose: "mfa-challenge"`, its own `JWT_MFA_SECRET`).
  `POST /auth/mfa/verify` exchanges it plus a TOTP or backup code for a
  real token pair.
- `POST /auth/mfa/disable` requires a valid TOTP/backup code, not just an
  access token, so a hijacked session alone can't turn MFA off.

### OAuth

`GoogleOAuthModule` (`modules/auth/oauth/`) is only imported into
`AuthModule` when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set —
unset, the `/auth/oauth/google*` routes don't exist at all rather than
existing and failing at request time. Google sign-in authenticates an
**existing** Omniflow account by email (it's an alternative credential,
not a way to auto-create new tenants — that stays behind
`/auth/register`) and skips MFA, since the OAuth provider already
performed its own strong authentication.

### Rate limiting

Global default via `@nestjs/throttler`: 100 requests/minute per client.
`/auth/register`, `/auth/login`, `/auth/mfa/verify`,
`/auth/password/forgot`, and `/auth/password/reset` carry stricter
per-route limits (5–10/minute) to slow down credential-stuffing and
brute-force attempts.

### Registration

`POST /auth/register` creates a new **Company** (tenant), a
"Headquarters" branch, a company-scoped "Super Admin" role granted every
seeded permission, and the requesting user — assigned that role
company-wide and that branch as primary — all in one transaction, then
logs the user in immediately. Adding further users to that company is
`POST /users` (see below).

## User management & RBAC

Source: `apps/api/src/modules/{users,roles,permissions,branches}/`,
`apps/api/src/common/{authorization,guards,decorators}/`.

### Permission model

- **Permission** is a global, seeded catalog of `module:action` keys
  (`packages/shared/src/constants/permissions.ts` is the single source
  of truth — both the Prisma seed script and a `PermissionsService`
  `OnModuleInit` hook upsert from it, so RBAC works whether or not
  `pnpm db:seed` was ever run).
- **Role** is company-scoped (custom roles created via `POST /roles`) or
  a company-scoped **system** role (`isSystem: true` — currently just
  "Super Admin", created at registration; system roles can't be renamed,
  have their permissions changed, or be deleted).
- **UserRole** grants a role to a user, either company-wide (`branchId`
  null) or scoped to one branch. A user's *effective permissions* are
  the union of every permission on every role they hold
  (`AuthorizationService.getEffectivePermissions`) — row-level
  enforcement of "only within that branch" is a further refinement left
  for later; today a granted permission applies wherever the user
  operates.
- **UserBranch** grants a user access to a branch (multi-branch support),
  independent of role scoping.

### Enforcement

`@RequirePermissions(...keys)` sets route metadata; the global
`PermissionsGuard` (an `APP_GUARD`, running after `JwtAuthGuard`) reads
it and 403s if the current user's effective permissions don't cover
every required key. Routes with no `@RequirePermissions` are open to any
authenticated user (e.g. `GET /users/me`). Permissions are recomputed
from the database on every request rather than cached in the JWT, so
revoking a permission (or deleting the granting role) takes effect on
a user's *existing* access token immediately, not just after their next
login — verified in `test/rbac.e2e-spec.ts`.

### Multi-tenancy

Every service method takes the caller's `companyId` (from the JWT, never
from the request body/params) and scopes every query to it; looking up
another tenant's record by ID returns 404 rather than 403, so tenant
existence isn't leaked. Creating a user/role/branch validates that any
referenced IDs (branches, roles) belong to the same company.

### Guard rails

Beyond permission checks: users can't delete their own account; a role
can't be deleted while any user still holds it (must be revoked first);
a branch can't be deleted while it has assigned users, and the
headquarters branch can never be deleted; deactivating a user
(`PATCH /users/:id` with a non-`ACTIVE` status, or `DELETE /users/:id`)
revokes all of their sessions immediately, the same way a password reset
does.

## Dashboard

Source: `apps/api/src/modules/dashboard/`.

- `GET /dashboard/summary` — headline counts (active/total users,
  branches, unread notifications) for the caller's company. Open to any
  authenticated user (no `@RequirePermissions`) since it's read-only,
  company-scoped, and not sensitive. Backed by the `company_dashboard_stats`
  view from Milestone 2 via `$queryRaw` rather than re-deriving the same
  aggregation with Prisma's query builder — the view is the single source
  of truth for these counts, shared with any future BI/reporting use.
- `GET /dashboard/activity-by-action` and `GET /dashboard/recent-activity`
  — audit log activity, grouped by action or as a raw recent feed. Gated
  behind `audit_logs:read`, so a low-privilege user simply doesn't see
  those cards (the web app hides them on a 403 rather than erroring).

## Core framework (Milestone 6)

### Audit logging

Source: `apps/api/src/common/audit/`.

Mutating REST routes get an audit-log entry automatically — no
hand-written `prisma.auditLog.create(...)` call needed in the
controller. Decorate a controller (or a single handler, to override)
with `@AuditEntity("EntityName")`; the global `AuditInterceptor` infers
the action from the HTTP verb (`POST` → `CREATE`, `PATCH`/`PUT` →
`UPDATE`, `DELETE` → `DELETE`; `GET` is never logged) and the entity id
from the response body's `id` field or the `:id` route param. The write
is awaited before the response completes (not fire-and-forget) — an
audit trail a client can't yet see if it queries immediately after
isn't trustworthy — but a failure to write the audit log never fails
the request itself. `AuthService` still writes its own entries directly
for events that don't map to a CRUD verb (login, logout, password
reset).

### Notifications & realtime

Source: `apps/api/src/modules/notifications/`, `apps/api/src/realtime/`,
`apps/api/src/common/events/domain-events.ts`.

- `GET /notifications`, `GET /notifications/unread-count`,
  `POST /notifications/:id/read`, `POST /notifications/read-all` — a
  user's own notifications only.
- Notifications are created by **event listeners**, not direct calls
  from the module that triggered them: `NotificationsService.create()`
  emits `notification.created` on an in-process event bus
  (`@nestjs/event-emitter`); `NotificationTriggersListener` reacts to
  `user.created` (welcome notification) and `role.granted` (access
  change notice) by calling it. Adding "when X happens, notify Y" for a
  future module is a new `@OnEvent` listener, not a new dependency on
  `NotificationsService` from the module that emits X.
- `RealtimeGateway` (Socket.IO, namespace `/realtime`) authenticates the
  handshake with the same access-token JWT used for REST (`auth: { token }`),
  joins each connection to `user:<id>` and `company:<id>` rooms, and
  listens for the same `notification.created` event to push a live
  `notification` message to the recipient's room. Verified end-to-end
  with a real client (register → connect → grant a role from a second
  session → live push received) rather than just unit-tested, since a
  mocked Socket.IO server wouldn't prove the room-based auth/targeting
  actually works.

### File storage & attachments

Source: `apps/api/src/common/storage/`, `apps/api/src/modules/attachments/`.

`StorageService` wraps `@aws-sdk/client-s3` — works against MinIO
locally (`S3_ENDPOINT` set, `forcePathStyle: true`) and real AWS S3 in
production (`S3_ENDPOINT` unset) with no code change. `POST /attachments`
(multipart, 25MB cap enforced both at the multer layer and in the
service) stores a file under any record via `entityType`/`entityId`
(the same polymorphic pattern as `comments` and `audit_logs`);
`GET /attachments/:id/download` returns a short-lived signed URL rather
than proxying the file through the API. Not verified against a live
MinIO in this environment (no Docker daemon / network access to fetch a
MinIO binary in the sandbox this was built in) — covered by unit tests
with a mocked S3 client instead; verify against the real
`docker-compose` MinIO service before relying on it in production.

### GraphQL

Source: `apps/api/src/app.module.ts` (driver setup), a `*.resolver.ts` +
`graphql/*.type.ts` pair per module, schema served at `/api/v1/graphql`
(also written to `apps/api/src/schema.gql` at boot — code-first,
gitignored, regenerated every start).

Every REST guard/decorator (`JwtAuthGuard`, `PermissionsGuard`,
`AppThrottlerGuard`, `@RequirePermissions`, `@CurrentUser`) works
unchanged for GraphQL — `getRequestFromContext()`
(`common/utils/execution-context.util.ts`) is the one place that branches
on transport type (`context.getType() === "graphql"` → pull `req` out of
the Apollo context; otherwise `context.switchToHttp()`), so every other
piece of shared auth/authz code stays transport-agnostic. Resolvers are
thin — they call the same `*Service` methods the REST controllers do, so
GraphQL and REST are two views over one business-logic layer, never two
implementations that could drift.

Current coverage: `me`, `users`, `user`, `roles`, `role`, `branches`,
`branch`, `dashboardSummary`, `notifications`, `unreadNotificationCount`
queries, and one mutation (`markNotificationRead`). Broader mutation
coverage (create/update/delete for users, roles, branches) is a
deliberate fast-follow, not a gap in the guard/resolver plumbing — REST
already covers all of it today.

### Plugin system

Source: `apps/api/src/modules/plugins/`.

`Plugin` (global catalog, seeded on boot like the permission catalog)
and `CompanyPlugin` (per-company install/enable state + JSON config) are
the Milestone 2 schema tables this finally wires up.
`GET /plugins`, `GET /plugins/installed`, `POST /plugins/:key/enable`
(body: `{ config }`), `POST /plugins/:key/disable` — all behind
`settings:manage`.

The extension point is the same domain-event bus notifications use:
`PluginEventBridgeService` listens for `notification.created`, and for
any company with the built-in `webhook-notifier` plugin enabled with a
`webhookUrl` configured, hands off to the job queue (below) rather than
making the outbound HTTP call inline. Adding a second plugin reacting to
a second event is a catalog entry plus another `@OnEvent` branch in the
bridge — the pattern doesn't change. Verified end-to-end with a real
worker process and a local HTTP receiver: enable the plugin → trigger an
event → confirm the receiver actually got the POST.

### Job queue & worker

Source: `apps/api/src/jobs/` (producer), `apps/worker` (consumer),
`packages/shared/src/constants/jobs.ts` (the queue/job-name contract
between them).

Redis-backed BullMQ. Two queues: `maintenance` (a daily repeatable
`cleanup-expired-sessions` job, scheduled once at API boot, deletes
sessions expired/revoked more than 30 days ago) and `webhooks`
(on-demand `deliver-webhook` jobs from the plugin bridge, 3 attempts
with exponential backoff — third-party endpoints are unreliable by
nature). `apps/worker` is a separate NestJS process with no HTTP
surface — `NestFactory.createApplicationContext`, not `.listen()` —
sharing `@omniflow/database`/`@omniflow/shared` but otherwise fully
independently deployable and scalable from the API. See
`apps/worker/README.md`.

### Security middleware

`main.ts`: `helmet()` (default policy), `compression()`, CORS restricted
to `CORS_ORIGIN` (comma-separated origins; unset falls back to allow-all
for local dev only — always set it in production), a global
`ValidationPipe` (`whitelist` + `forbidNonWhitelisted`, rejecting any
request body field not declared on the DTO), and a `GlobalExceptionFilter`
that centralizes 5xx logging and guarantees a generic message for any
error that isn't a deliberately-thrown `HttpException` — while
deliberately preserving Nest's default REST error shape
(`{ statusCode, message, error }`) rather than introducing a new
envelope, since the web app's error handling and every e2e test already
depend on it.

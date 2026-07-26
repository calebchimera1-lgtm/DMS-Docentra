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

## CRM (Milestone 7 — first business module)

Source: `apps/api/src/modules/crm/` (`accounts/`, `contacts/`,
`leads/`, `deals/`, `reports/`), `apps/api/src/modules/comments/`
(new generic module, added alongside this milestone).

The first of the ~50 planned business modules, and the template the
rest follow: each entity gets REST CRUD + a parallel GraphQL query
surface, search/filter/pagination, CSV export, RBAC, audit logging
(automatic via `@AuditEntity`), and the two generic cross-cutting
features built in Milestone 6 — comments and attachments — wired in via
`entityType`/`entityId` rather than bespoke per-module code.

### Entities

- **Accounts** (`crm_accounts`) — customer/prospect organizations.
- **Contacts** (`crm_contacts`) — people, optionally linked to an
  account.
- **Leads** (`crm_leads`) — unqualified prospects with a status
  (`NEW → CONTACTED → QUALIFIED → CONVERTED`/`LOST`) and a
  `POST /crm/leads/:id/convert` action that creates an Account (if the
  lead has a company name) + a Contact in one transaction and marks the
  lead `CONVERTED`.
- **Deals** (`crm_deals`) — opportunities moving through a pipeline
  (`PROSPECTING → QUALIFICATION → PROPOSAL → NEGOTIATION → WON`/`LOST`),
  with a value in cents + currency and an optional account/contact
  link.

All four are company-scoped, soft-deleted (`deletedAt`), and permission
gated by a single set of module-level permissions — `crm:read`,
`crm:write`, `crm:delete` — rather than one per entity, matching the
granularity of `branches:manage`/`settings:manage` elsewhere in the
catalog instead of multiplying into a dozen-plus CRM-specific keys.

### Reports & export

`GET /crm/reports/summary` (also exposed as the `crmSummary` GraphQL
query, used by the CRM dashboard's stat tiles), `GET
/crm/reports/pipeline` (deal count + value grouped by stage — powers
the dashboard's stage bar chart), and `GET /crm/reports/leads-funnel`
(lead count grouped by status). Every list endpoint also has a sibling
`GET .../export` returning `text/csv` of the current filtered result
set (capped at 5,000 rows), registered before the `:id` route so the
literal `export` path segment isn't swallowed by the id param.

### Generic comments module

`apps/api/src/modules/comments/` mirrors the Attachments module's
polymorphic `(entityType, entityId)` pattern from Milestone 6 —
`POST/GET /comments`, `PATCH/DELETE /comments/:id` (edit/delete
restricted to the comment's own author) — so any future module can add
a comment thread to its records with zero new backend code, the same
way Attachments already works for file uploads.

### Frontend

`apps/web/src/app/(dashboard)/crm/` — an overview page (stat tiles +
pipeline-by-stage bar chart, styled per the dataviz skill's mark specs
to match the Milestone 5 dashboard chart) plus list pages for each
entity (search, filters, inline create, CSV export via an authenticated
blob download — `window.open` can't carry the Bearer token, so exports
are fetched through the API client and turned into a
`Blob`/`URL.createObjectURL` download) and an account detail page
nesting its contacts/deals plus the first live usage of the
`CommentsPanel`/`AttachmentsPanel` components, both reusable by any
future module's detail page.

### A gotcha worth knowing: granting a brand-new permission

Adding a permission key to `PERMISSION_CATALOG` only inserts the
`Permission` row (done automatically at API boot and via `db:seed`) —
it does **not** retroactively grant it to existing roles. Freshly
registered companies pick it up automatically (`AuthService.register`
grants its Super Admin role every permission that exists in the table
at registration time), but a pre-existing company's roles need it
granted explicitly (re-run `db:seed` for the local demo company, or use
the Roles UI/API in a real one) — the same way any other new permission
would need rolling out.

## Sales (Milestone 7b — second business module)

Source: `apps/api/src/modules/sales/` (`products/`, `quotes/`,
`orders/`, `invoices/`, `reports/`, `common/`).

The quote-to-cash flow, built on top of the CRM accounts/contacts from
Milestone 7a. Same shape as CRM (REST + GraphQL, search/pagination,
CSV export, RBAC, audit logging), plus a document-conversion chain
that's the module's centerpiece.

### Entities

- **Products** (`products`) — the sellable catalog: SKU (unique per
  company), name, unit price, currency, active flag. Plain CRUD, no
  line items of its own.
- **Quotes** (`quotes`) — sent to a CRM account (optionally a specific
  contact), moving through `DRAFT → SENT → ACCEPTED`/`REJECTED`/
  `EXPIRED`. `POST /sales/quotes/:id/convert-to-order` requires
  `ACCEPTED` and refuses a second conversion (checked via the 1:1
  `Quote.salesOrder` relation).
- **Sales Orders** (`sales_orders`) — `DRAFT → CONFIRMED → FULFILLED`/
  `CANCELLED`, created either by converting a quote or directly.
  `POST /sales/orders/:id/convert-to-invoice` creates an Invoice with a
  30-day due date and refuses a second conversion.
- **Invoices** (`invoices`) — `DRAFT → SENT → PAID`/`OVERDUE`/
  `CANCELLED`. `POST /sales/invoices/:id/mark-paid` sets `paidAt` and
  refuses to run twice or on a cancelled invoice. Payment collection
  itself (gateways, ledger entries) is out of scope here — this module
  only records that money arrived, matching the "Sales" vs. future
  "Accounting" boundary.

All four share one permission set (`sales:read`/`sales:write`/
`sales:delete`), the same granularity choice as CRM.

### Line items are a JSON snapshot, not a live join

Quotes/Orders/Invoices store `items` as a JSON array
(`{ productId?, description, quantity, unitPriceCents, totalCents }`)
computed server-side from the request (`priceLineItems` in
`sales/common/line-item.dto.ts`), rather than a child table joined to
`Product`. This is deliberate: a quote's price and description must
never change after the fact just because the underlying product was
later repriced or renamed — the document is a point-in-time snapshot.
GraphQL exposes `items` as a typed `[LineItemType]` rather than a raw
JSON scalar (the project has no `graphql-type-json` dependency, and a
typed list is cleaner anyway).

### Document numbers

`Q-000001`, `SO-000001`, `INV-000001` — a zero-padded, per-company
running count (`formatDocumentNumber` in
`sales/common/document-number.util.ts`). Not strictly collision-proof
under concurrent creates (no row lock), but the `@@unique([companyId,
quoteNumber])` constraint (and siblings) makes any race fail safe with
a 500 rather than silently duplicating a number.

### Reports & export

`GET /sales/reports/summary` (active product count, open quotes/
orders, revenue booked — all non-cancelled order totals — vs. revenue
collected — paid invoice totals, overdue invoice count) and `GET
/sales/reports/invoices-by-status` (count + value grouped by status,
powering the Sales overview's chart). Every list endpoint has a CSV
export sibling, same pattern as CRM.

### Frontend

`apps/web/src/app/(dashboard)/sales/` — an overview page (stat tiles +
an invoice-status bar chart reusing CRM's `StageBarChart` component),
a Products page with inline create, a Quotes page with a dynamic
line-item editor (`LineItemsEditor`, add/remove rows, live subtotal)
and a "Convert to order" action once a quote is accepted, and
Orders/Invoices pages that are conversion-driven (status changes and
"Convert to invoice"/"Mark paid" actions) rather than directly
creatable — the UI nudges toward the same quote → order → invoice
flow the backend enforces, even though the REST API itself allows
creating an order or invoice directly.

## Inventory (Milestone 7c — third business module)

Source: `apps/api/src/modules/inventory/` (`warehouses/`, `stock/`,
`movements/`, `reports/`).

Warehouses, per-warehouse stock levels, and a movement ledger — built
on the `Product` catalog from Sales (Milestone 7b) rather than
introducing a second product model. This is the module where "the
number on screen" and "the audit trail of how it got there" have to
agree by construction, not by convention.

### Entities

- **Warehouses** (`warehouses`) — a physical/logical stock location,
  company-unique code. Cannot be deleted while any `StockItem` still
  holds a non-zero quantity.
- **Stock items** (`stock_items`) — the *current* on-hand quantity of
  a `Product` at a `Warehouse` (`@@unique([productId, warehouseId])`),
  plus a reorder point/quantity. This is a **cache**, not a source of
  truth — see below.
- **Stock movements** (`stock_movements`) — an append-only ledger.
  `POST /inventory/movements` is the only way to change a stock
  item's quantity; there is no direct "set quantity" endpoint.

### The cache and the ledger can never drift apart

Recording a movement (`MovementsService.create`) runs inside a single
Prisma `$transaction`: it upserts the `StockItem` (creating it at zero
on first use), computes a signed delta from the movement type
(`RECEIPT`/`RETURN`/`TRANSFER_IN` are positive, `SALE`/`TRANSFER_OUT`
are negative, `ADJUSTMENT` takes the caller's signed value directly),
rejects the whole transaction with a 400 if the resulting quantity
would go negative (overselling/over-transferring prevention), and only
then writes both the updated `StockItem.quantityOnHand` and the new
`StockMovement` row. There is no code path that updates one without
the other.

### Reports & the low-stock query's tradeoff

`GET /inventory/reports/summary` (warehouse/tracked-item counts, total
units on hand, total stock value — quantity × unit price, summed
client-side after the query since it multiplies two columns from
different tables — low-stock count, total movement count) and `GET
/inventory/reports/movements-by-type`. The `lowStock=true` filter on
`GET /inventory/stock` has the same two-columns-on-one-row problem
(`quantityOnHand <= reorderPoint`): Prisma's query builder can't
express it, so that filter fetches the (already company/warehouse/
product-scoped) result set unpaginated and filters/paginates in
memory. Fine at the scale a single company's stock table reaches;
would need a raw query or a generated column at real scale — noted
in a comment at the filtering code rather than silently accepted.

### Frontend

`apps/web/src/app/(dashboard)/inventory/` — an overview (stat tiles +
a movements-by-type bar chart), a Warehouses page, a Stock page
(low-stock checkbox filter, inline reorder-point editing, per-row
value = quantity × unit price), and a Movements page with a
record-movement form (product/warehouse/type selects, a quantity
field whose placeholder changes to clarify signed input for
`ADJUSTMENT`). Browser-testing this form caught a real bug before it
shipped: the "show the create form" toggle button and the form's own
submit button were both labeled "Record movement", so an automated
click on that accessible name hit the toggle instead of the submit
and silently closed the form. Renamed the toggle to "New movement" —
matching the "New X" / "Create X" (or here, "Record movement")
convention every other module's create form already followed.

## Accounting (Milestone 7d — fourth business module)

Source: `apps/api/src/modules/accounting/` (`ledger-accounts/`,
`journal-entries/`, `payments/`, `reports/`).

A chart of accounts, double-entry journal entries, and payments —
built on the `CrmAccount`/`Invoice` records from CRM and Sales rather
than introducing parallel concepts. This is the module where
correctness isn't optional: an unbalanced entry or a payment that
doesn't post a matching journal entry would silently corrupt every
report built on top of it, so the invariants are enforced at the
point of writing, not caught later.

### Entities

- **Ledger accounts** (`ledger_accounts`) — the chart of accounts.
  Modeled as `LedgerAccount`, not `Account`, to stay unambiguous next
  to CRM's `CrmAccount` (a customer/prospect) — the same naming
  discipline already applied to `NotificationItemType` and
  `StockMovementItemType` on the GraphQL side (see below). Each has a
  `type` (`ASSET`/`LIABILITY`/`EQUITY`/`REVENUE`/`EXPENSE`) that
  determines its normal balance side. Deletion is blocked once any
  `JournalLine` references it.
- **Journal entries** (`journal_entries` + `journal_lines`) —
  `DRAFT → POSTED`. `JournalEntriesService.create` requires every line
  to have exactly one non-zero side and the entry's total debits to
  equal its total credits, rejecting anything else with a 400 before
  a single row is written. Once `POSTED`, an entry is immutable — it
  cannot be deleted, and posting again is refused. There is
  deliberately no "unpost" or "edit a posted entry" endpoint; fixing a
  mistake means a new offsetting entry, the same as real bookkeeping.
- **Payments** (`payments`) — records money moving between two ledger
  accounts (e.g. Bank ← Accounts Receivable), optionally settling a
  Sales `Invoice`. `PaymentsService.create` runs in one transaction:
  post a balanced `JournalEntry` (two lines, both sides equal to the
  payment amount) and, if an invoice was named, mark it `PAID` — a
  payment and its journal entry are created together or not at all,
  and paying an already-paid invoice is rejected up front.

All three share one permission set (`accounting:read`/`write`/
`delete`), same granularity as CRM/Sales/Inventory.

### GraphQL naming: the fourth collision, guarded the same way

`LedgerAccountType` is both the Prisma enum (asset/liability/…) and
what the natural GraphQL object name would have been — the same
collision already hit and fixed for `NotificationType` (Milestone 6)
and `StockMovementType` (Milestone 7c). The GraphQL object type is
`LedgerAccountItemType` here, matching the established
`*ItemType` convention rather than reaching for a different pattern
each time.

### Reports

`GET /accounting/reports/summary` (ledger account count, draft entry
count, total assets/liabilities/equity/revenue/expenses, and net
income = revenue − expenses) and `GET
/accounting/reports/balances-by-type` (debit/credit totals and net
balance per account type, powering the Accounting overview's chart).
Both only consider `POSTED` journal lines — a draft entry hasn't
happened yet from the ledger's point of view, so it can't move a
reported balance. Computing "debit − credit" vs. "credit − debit" per
type depends on the type's normal balance side (`ASSET`/`EXPENSE` are
debit-normal; `LIABILITY`/`EQUITY`/`REVENUE` are credit-normal) —
encoded once in `AccountingReportsService.balanceFor` rather than
duplicated per report.

### Frontend

`apps/web/src/app/(dashboard)/accounting/` — an overview (stat tiles +
a balances-by-type bar chart reusing CRM's `StageBarChart`), a Chart
of Accounts page, a Journal Entries page with a debit/credit line
editor (`JournalLinesEditor` — each line picks a ledger account and a
side rather than exposing two separate debit/credit fields, with a
live running total that turns red until debits equal credits) plus a
click-to-expand row showing posted lines and a "Post" action on
drafts, and a Payments page whose record-payment form can optionally
tie to an outstanding Sales invoice.

## HR (Milestone 7e — fifth business module)

Source: `apps/api/src/modules/hr/` (`departments/`, `employees/`,
`leave-requests/`, `reports/`, plus shared GraphQL ref types in
`common/hr-refs.type.ts`).

Departments, employees, and a leave-request approval workflow. Unlike
every prior module, HR records reference each other in a cycle — a
`Department` has a `manager` (an `Employee`), and an `Employee` has a
`department` — so this is the first module where cross-referencing
GraphQL object types are factored into a shared file
(`DepartmentRef`/`EmployeeRef` in `common/hr-refs.type.ts`) rather than
defined one-directionally the way `StockProductRef`/`StockWarehouseRef`
were for Inventory.

### Entities

- **Departments** (`departments`) — name, code (unique per company),
  active flag, and an optional manager (an `Employee`). Deletion is
  blocked while any employee is still assigned to it.
- **Employees** (`employees`) — the HR record. Deliberately **not**
  assumed to have a system login: `userId` is an optional, unique
  back-reference to a `User`, and `firstName`/`lastName`/`email`/
  `phone` are stored on `Employee` itself rather than read through the
  user relation, since a contractor or a not-yet-onboarded hire may
  never get one. `employeeNumber` is auto-generated the same way as
  every other document number in the app (`formatDocumentNumber("EMP",
  count)`, reused from Sales). Employees can reference a `department`
  and a `manager` (a self-relation on `Employee`), both validated to
  belong to the same company, and a manager can't be set to the
  employee itself. A dedicated `POST /hr/employees/:id/terminate`
  transitions `status` to `TERMINATED` and stamps `terminationDate`
  rather than allowing that through the general-purpose update
  endpoint. Deletion is blocked while the employee still manages a
  department or has direct reports — reassign them first.
- **Leave requests** (`leave_requests`) — `type`
  (`VACATION`/`SICK`/`UNPAID`/`OTHER`) plus a date range against one
  `Employee`, starting `PENDING`. There's no soft-delete field on this
  model by design — a leave request is either still pending (and can
  be `cancel`led by the requester) or already reviewed (`approve`d /
  `reject`ed), and reviewed history is kept, not deleted.
  `approve`/`reject` both resolve the *calling user* to *their own*
  `Employee` profile (`Employee.userId === currentUser.id`) to stamp as
  `approverId` — a new wrinkle none of the earlier modules had, since
  every other module's "acting user" was already the right ID to
  record. A caller with no linked employee profile gets a 403 rather
  than silently approving with a null approver.

All three share one permission set (`hr:read`/`write`/`delete`), same
granularity as every other business module.

### GraphQL naming

`EmploymentType`, `EmployeeStatus`, `LeaveType`, and
`LeaveRequestStatus` were named up front specifically so they wouldn't
collide with the natural GraphQL object names (`EmployeeType`,
`DepartmentType`, `LeaveRequestType`) the way `NotificationType`,
`StockMovementType`, and `LedgerAccountType` did in earlier milestones
— so HR's GraphQL types didn't need the `*ItemType` collision-avoidance
suffix reactively, only proactively-chosen enum names.

### Reports

`GET /hr/reports/summary` (active/total employee counts, on-leave
count, active department count, pending leave request count) and `GET
/hr/reports/headcount-by-department` (active, non-terminated headcount
per department, plus an "Unassigned" bucket for employees without a
department), powering the HR overview's stat tiles and bar chart.

### Frontend

`apps/web/src/app/(dashboard)/hr/` — an overview (stat tiles + a
headcount-by-department bar chart reusing CRM's `StageBarChart`), a
Departments page, an Employees page with a "Terminate" row action, and
a Leave Requests page with per-row Approve/Reject/Cancel actions on
pending requests.

## Projects (Milestone 7f — sixth business module)

Source: `apps/api/src/modules/projects/` (`projects/`, `tasks/`,
`time-entries/`, `reports/`, plus shared GraphQL ref types in
`common/project-refs.type.ts`).

Projects, tasks, and time tracking. A project optionally belongs to a
CRM account (client work) and has an optional owner (a `User`); tasks
belong to a project and are optionally assigned to a `User`; time
entries are minutes logged against a task by the user who did the
work — modeled as an integer (`minutes`), the same "no floats for a
countable unit" discipline the schema already applies to money
(`*Cents`) and stock (`quantityOnHand`).

### Entities

- **Projects** (`projects`) — name, code (unique per company),
  `status` (`PLANNING`/`ACTIVE`/`ON_HOLD`/`COMPLETED`/`CANCELLED`),
  optional date range and budget, an optional `CrmAccount` link, and an
  optional owning `User`. Deletion is blocked while the project still
  has tasks.
- **Tasks** (`project_tasks`) — title, `status`
  (`TODO`/`IN_PROGRESS`/`IN_REVIEW`/`DONE`), `priority`
  (`LOW`/`MEDIUM`/`HIGH`/`URGENT`), an optional due date and estimate,
  and an optional assignee. Deletion is blocked once any time has been
  logged against it, the same "can't delete once it has activity"
  invariant used for ledger accounts and warehouses.
- **Time entries** (`time_entries`) — minutes logged against a task by
  a `User`, always the calling user (there's no field to log time on
  someone else's behalf). Editing or deleting a time entry is
  restricted to the user who logged it — `TimeEntriesService` checks
  `entry.user.id === callingUserId` and throws a 403 otherwise, a
  narrower-than-usual write permission model since `projects:write`
  alone isn't sufficient to touch someone else's log.

All three share one permission set (`projects:read`/`write`/`delete`),
same granularity as every other business module.

### A routing bug, caught and fixed before it shipped

`ProjectsController` owns `GET/PATCH/DELETE "projects/:id"` — a
wildcard. `TasksController` and `TimeEntriesController` sit at the
literal sub-paths `"projects/tasks"` and `"projects/time-entries"`.
Nest (via Express under the hood) matches routes in **registration
order**, not by specificity, so with `ProjectsController` registered
first in `ProjectsModule`, a request for `GET /projects/tasks` was
being caught by `projects/:id` (with `id="tasks"`) before it ever
reached `TasksController`, producing a 404 "Project not found". Fixed
by registering the literal-path controllers (`TasksController`,
`TimeEntriesController`, `ProjectsReportsController`) before
`ProjectsController` in the module's `controllers` array — caught via
the manual browser smoke test (an uncaught "Project not found" page
error on `/projects/tasks`), and pinned down with a regression test in
`projects.e2e-spec.ts` so a future sub-resource added the same way
doesn't reintroduce it silently.

### Reports

`GET /projects/reports/summary` (active/total project counts, open and
overdue task counts, total minutes logged) and `GET
/projects/reports/tasks-by-status` (task counts grouped by status),
powering the Projects overview's stat tiles and bar chart.

### Frontend

`apps/web/src/app/(dashboard)/projects/` — an overview (stat tiles + a
tasks-by-status bar chart reusing CRM's `StageBarChart`), a Projects
list page, a Tasks page with an inline status-change dropdown per row,
and a Time Entries page with a delete action scoped to the calling
user's own entries. The projects list itself lives at `/projects/list`
rather than `/projects` (the overview's route) — mirroring the same
"entity list needs a non-root path so it doesn't collide with sibling
routes" fix applied on the backend.

## Support (Milestone 7g — seventh business module)

Source: `apps/api/src/modules/support/` (`tickets/`, `reports/`).

Helpdesk tickets — the first business module with only one real data
model. Replies and file attachments deliberately don't get their own
`TicketComment`/`TicketAttachment` tables: they reuse the generic
`Comment`/`Attachment` models (already polymorphic via
`entityType`/`entityId`, introduced in Milestone 7a for CRM) with
`entityType: "Ticket"`. Building a parallel comment/attachment system
for one more entity would have been pure duplication — the generic
version already does everything a ticket reply needs.

### Entities

- **Tickets** (`tickets`) — `ticketNumber` (auto-generated, same
  `formatDocumentNumber` convention as every other document number in
  the app), `status`
  (`OPEN`/`IN_PROGRESS`/`WAITING_ON_CUSTOMER`/`RESOLVED`/`CLOSED`),
  `priority` (`LOW`/`MEDIUM`/`HIGH`/`URGENT`), an optional link to a
  `CrmAccount` and/or `CrmContact` (for tickets raised by an existing
  customer), a free-text `requesterEmail` (for tickets that aren't
  tied to a CRM contact at all), and an optional assignee. Creating a
  ticket with an assignee already set skips `OPEN` and starts it
  `IN_PROGRESS` directly, the same shortcut `assign` applies when
  called later.

### Workflow

Four actions beyond plain CRUD, each guarding its own preconditions
the same way Accounting's journal-entry `post` and HR's leave-request
`approve`/`reject` do:

- `POST /support/tickets/:id/assign` — sets the assignee; if the
  ticket was still `OPEN`, moves it to `IN_PROGRESS` in the same call
  (an assigned-but-still-technically-unstarted ticket would be a
  confusing state to leave visible on a queue view).
- `POST /support/tickets/:id/resolve` — only from an open-ish status
  (`OPEN`/`IN_PROGRESS`/`WAITING_ON_CUSTOMER`); stamps `resolvedAt`.
- `POST /support/tickets/:id/close` — from any non-`CLOSED` status
  (closing doesn't require having resolved it first — some tickets get
  closed as "won't fix" or duplicate); stamps `closedAt`.
- `POST /support/tickets/:id/reopen` — only from `RESOLVED` or
  `CLOSED`; clears both `resolvedAt` and `closedAt`.

All under one permission set (`support:read`/`write`/`delete`).

### Avoiding the Projects routing bug by construction

Milestone 7f's Projects module hit a real routing collision: a
wildcard `GET "projects/:id"` on the module's own base controller
shadowed literal sibling routes like `"projects/tasks"` because
Nest/Express match in registration order (see
[above](#a-routing-bug-caught-and-fixed-before-it-shipped)). Support
has only one entity, so `TicketsController` sits at `"support/tickets"`
and `SupportReportsController` at `"support/reports"` — two sibling
literal prefixes under `"support"`, with **no** controller claiming
the bare `"support"` root and its `:id` wildcard. There's nothing for
a wildcard to shadow, by construction, not by controller-ordering
discipline.

### Reports

`GET /support/reports/summary` (open/unassigned/overdue/total ticket
counts) and `GET /support/reports/tickets-by-status` (ticket counts
grouped by status), powering the Support overview's stat tiles and bar
chart. "Overdue" and "unassigned" both scope to open-ish tickets only
— a resolved ticket past its due date isn't overdue, it's done.

### Frontend

`apps/web/src/app/(dashboard)/support/` — an overview (stat tiles + a
tickets-by-status bar chart), a Tickets list page, and a ticket detail
page (`/support/tickets/[id]`) with Resolve/Close/Reopen actions and
the same `CommentsPanel`/`AttachmentsPanel` components already built
for the CRM account detail page in Milestone 7a — imported directly
from `components/crm/`, unchanged, since they only need an
`entityType`/`entityId` pair and were never actually CRM-specific.

## Purchase (Milestone 7h — eighth business module)

Source: `apps/api/src/modules/purchase/` (`suppliers/`, `orders/`,
`reports/`).

Suppliers, purchase orders, and goods receipts — the buy-side
counterpart to Sales, closing the loop with Inventory. Rather than
re-deriving patterns already proven out, this module leans hard on
reuse: `Supplier` is a new model (kept separate from CRM's
`CrmAccount`, the same way `LedgerAccount` was in Accounting — vendors
and customers/prospects are different concepts even when the shape
looks similar), but purchase order line items reuse Sales'
`LineItemDto`/`priceLineItems`/`LineItemType` outright, and document
numbering reuses `formatDocumentNumber`.

### Entities

- **Suppliers** (`suppliers`) — vendor master data: name, code (unique
  per company), contact details, active flag. Deletion is blocked
  while any purchase order references it.
- **Purchase orders** (`purchase_orders`) — `DRAFT → SENT → CONFIRMED
  → RECEIVED`, or `CANCELLED` from any pre-`RECEIVED` state. Line
  items are a JSON snapshot exactly like Sales' Quote/SalesOrder/
  Invoice (`unitPriceCents` here means "unit cost agreed with the
  supplier"). A `warehouseId` is required at creation — every order
  has a known destination before it's ever sent — and the order is
  editable via plain `PATCH` (including direct status transitions)
  right up until it's `RECEIVED` or `CANCELLED`, at which point it's
  immutable, the same rule Accounting applies to posted journal
  entries.
- **Goods receipts** (`goods_receipts`) — created by the dedicated
  `receive` action, never directly. One receipt per order (`purchase_order_id`
  is unique) — the same "one conversion each" simplicity Sales applies
  to Quote→Order→Invoice, and always a full receipt of every line, not
  a partial one.

### Receiving: the real cross-module integration point

`POST /purchase/orders/:id/receive` only works on a `CONFIRMED` order
with no existing receipt, and runs one transaction that, for every
line item with a `productId`: upserts the `StockItem` for
`(productId, warehouseId)` and bumps `quantityOnHand`, then inserts a
`StockMovement` of type `RECEIPT` referencing the order number — the
exact upsert-then-movement sequence Inventory's own
`MovementsService.create` uses, reimplemented here rather than having
Purchase call into Inventory's NestJS service directly (the same
direct-`tx`-call convention already used for Accounting's
invoice-marking-paid and CRM's lead conversion, keeping modules
decoupled at the service layer while still sharing one Prisma
transaction). Only then does it create the `GoodsReceipt` record and
flip the order to `RECEIVED`.

### Avoiding the Projects routing bug, again

Like Support, neither `SuppliersController` (`purchase/suppliers`)
nor `PurchaseOrdersController` (`purchase/orders`) claims the bare
`purchase` root — both are literal sibling sub-paths, so there's no
`:id` wildcard for either to shadow the other, or the reports
controller's `purchase/reports/*` routes. Same collision-avoidance-by-
construction as Support, now applied on reflex rather than as a fix.

### Reports

`GET /purchase/reports/summary` (active supplier count, open order
count, committed spend — the total value of `CONFIRMED`-but-not-yet-
received orders — and received order count) and `GET
/purchase/reports/orders-by-status`, powering the Purchase overview's
stat tiles and bar chart.

### Frontend

`apps/web/src/app/(dashboard)/purchase/` — an overview, a Suppliers
page, and a Purchase Orders page that reuses Sales'
`LineItemsEditor` component outright for the create form, plus a
click-to-expand row (the same pattern Accounting's Journal Entries
page uses for its lines) and per-row Send/Confirm/Receive buttons that
only appear for the status they apply to.

## Payroll (Milestone 7i — ninth business module)

Source: `apps/api/src/modules/payroll/` (`salary-components/`,
`pay-runs/`, `payslips/`).

Salary components, pay runs, and generated payslips — payroll built
directly on top of HR rather than beside it: `Employee.salaryCents`
(already on the schema since Milestone 7e) is the only source of an
employee's basic pay. There's no separate "employee salary structure"
model duplicating what HR already owns.

### Entities

- **Salary components** (`salary_components`) — the reusable catalog
  of pay codes (e.g. "Housing Allowance", "Income Tax") applied to
  every eligible employee when a pay run is generated. `value` is
  cents for `FIXED`, or basis points of the employee's basic salary
  for `PERCENTAGE` (`1000` = 10.00%) — the same integer-only, no-float
  discipline the schema already applies to money and stock quantities
  everywhere else.
- **Pay runs** (`pay_runs`) — a payroll period:
  `DRAFT → PROCESSED → PAID`, or `CANCELLED` from `DRAFT` or
  `PROCESSED`. Editable via plain `PATCH` only while `DRAFT`.
- **Payslips** (`payslips`) — one per employee per pay run, created
  only by the `generate` action, never directly (there's no `POST
  /payroll/payslips`). `items` is a JSON snapshot of the components
  applied at generation time, the same "never drift if the catalog
  changes later" convention as Sales' Quote/SalesOrder/Invoice line
  items.

### Generating: read-only computation, one real side effect

`POST /payroll/pay-runs/:id/generate` only works on a `DRAFT` run, and
computes a payslip for every `ACTIVE` employee with `salaryCents` set:
for each active `SalaryComponent`, `FIXED` adds/subtracts a flat cents
amount and `PERCENTAGE` adds/subtracts `round(basicSalaryCents *
value / 10000)`, then `grossPayCents = basic + earnings`,
`netPayCents = gross - deductions`. All payslips for the run are
created in one transaction alongside the run's `DRAFT → PROCESSED`
transition — the same "real side effect, so it's a dedicated action
rather than a plain status update" reasoning as PurchaseOrder's
`receive`. `POST /payroll/pay-runs/:id/mark-paid` then flips the run
and every one of its payslips to `PAID` in a second transaction,
stamping `paidAt`.

### Reports

`GET /payroll/reports/summary` (employees eligible for payroll, draft
and processed-but-unpaid run counts, and total net pay paid
all-time) and `GET /payroll/reports/payslips-by-status`, powering the
Payroll overview's stat tiles and bar chart.

### Frontend

`apps/web/src/app/(dashboard)/payroll/` — an overview, a Salary
Components page (with a single dollar/percent input scaled by 100 for
both `FIXED` and `PERCENTAGE`, since both are "value the user types
times 100"), and a Pay Runs page with a click-to-expand row showing
each generated payslip's basic/gross/deductions/net breakdown, and
per-row Generate/Mark paid/Cancel actions gated by the run's status.

## Expenses (Milestone 7j — tenth business module)

Source: `apps/api/src/modules/expenses/` (`expense-categories/`,
`expense-claims/`).

Employee expense claims with a categorized-line-item workflow that,
on approval, posts a real double-entry `JournalEntry` to Accounting —
the first business module to write directly into another module's
ledger tables via `tx.*` calls, the same cross-module convention
Purchase's `receive()` uses for Inventory's stock movements.

### Entities

- **Expense categories** (`expense_categories`) — a per-company
  catalog (Travel, Meals, Office Supplies, ...), each optionally
  mapped to the `LedgerAccount` it should debit on approval. Left
  unmapped, claims using that category can still be drafted and
  submitted, but `approve` rejects with a 400 until one is set.
- **Expense claims** (`expense_claims`) — `DRAFT → SUBMITTED →
  APPROVED → PAID`, with `REJECTED` reachable from `SUBMITTED` and
  `CANCELLED` from `DRAFT` or `SUBMITTED`. `items` is a JSON snapshot
  of `{ categoryId, categoryName, description, amountCents }` lines —
  the same "never drift if the category catalog changes later"
  convention as Sales' line items and Payroll's `Payslip.items`.
  Editable via `PATCH` only while `DRAFT`. `employeeId` is passed
  explicitly by the caller at creation (not resolved from the current
  user), the same convention HR's `LeaveRequest.create` uses.

### Approving: the real accounting side effect

`POST /expenses/claims/:id/approve` only works on a `SUBMITTED` claim
and takes a `creditAccountId` (the reimbursement-payable liability
account) in its body — mirroring how Accounting's `Payment.create`
takes its debit/credit accounts explicitly rather than inferring them.
It groups the claim's line items by category, sums each group's
`amountCents`, and — inside one `$transaction` — creates a `POSTED`
`JournalEntry` with one debit line per category (against that
category's mapped `LedgerAccount`) and a single credit line for the
claim's `totalCents` against the caller's `creditAccountId`, then
stamps the claim `APPROVED` with the new entry's id. Any category
without a mapped ledger account fails the whole approval with a 400
naming the category, before any journal lines are written. `POST
/expenses/claims/:id/reject` (with a required `rejectionReason`) and
`POST /expenses/claims/:id/approve`'s approver are both resolved from
the caller's own linked `Employee` profile, the same
`resolveCurrentEmployee` pattern HR's leave-request approval uses.
`POST /expenses/claims/:id/mark-paid` is a terminal status flip from
`APPROVED` to `PAID`, stamping `paidAt` — Payroll's `markPaid`
precedent, not a second journal entry (the payable was already
recorded at approval).

`ExpensesModule`'s controllers all sit under literal sub-paths
(`categories`, `claims`, `reports`) — no controller claims the bare
`expenses` root, so there's no `:id` wildcard for any sibling route to
shadow (the Projects routing bug avoided by construction, same as
every module since).

### Reports

`GET /expenses/reports/summary` (draft/submitted/approved-unpaid claim
counts and total paid all-time), `GET
/expenses/reports/claims-by-status`, and `GET
/expenses/reports/spend-by-category` — the last aggregated in
application code over each approved/paid claim's JSON line items
rather than a SQL `groupBy`, since categories live inside that JSON
snapshot, not a relational join table.

### Frontend

`apps/web/src/app/(dashboard)/expenses/` — an overview (stat tiles
plus claims-by-status and spend-by-category bar charts), a Categories
page (with a ledger-account picker sourced from
`/accounting/ledger-accounts`), and a Claims page with a dynamic
multi-line create form (add/remove category/description/amount rows),
a click-to-expand row showing the line-item and rejection-reason/
journal-entry detail, and per-row Submit/Cancel, Approve (with an
inline credit-account picker)/Reject (with an inline reason input),
and Mark paid actions gated by the claim's status.

## Assets (Milestone 7k — eleventh business module)

Source: `apps/api/src/modules/assets/` (`asset-categories/`,
`assets/`, `depreciation-runs/`, `depreciation-lines/`).

A fixed-asset register with straight-line depreciation runs and a
disposal workflow that computes and posts any resulting gain or loss —
the most involved accounting integration yet, extending the
"group line items by category into balanced journal lines" idiom
Expenses' `approve()` established, and adding a four-line balanced
entry (asset, cash, accumulated depreciation, gain/loss) for disposal.

### Entities

- **Asset categories** (`asset_categories`) — a per-company catalog
  (Computers, Vehicles, ...) carrying a default useful life and three
  ledger account mappings: the fixed-asset account (credited on
  disposal), the depreciation expense account (debited each
  depreciation run), and the accumulated-depreciation contra-asset
  account (credited each depreciation run, debited on disposal). Any
  left unset still allows registering assets in that category — it
  only blocks `generate`/`dispose`, the same unmapped-category pattern
  Expenses applies.
- **Assets** (`assets`) — `ACTIVE → DISPOSED`. Registering one does
  **not** post an acquisition journal entry — the purchase is assumed
  already recorded elsewhere (e.g. via Purchase + a Payment), so this
  module stays focused on depreciation and disposal rather than
  double-booking the acquisition. `purchaseCostCents`/`purchaseDate`
  are immutable once set; everything else (`name`, `salvageValueCents`,
  `usefulLifeMonths`, `note`, `categoryId`) is editable while `ACTIVE`.
  Deleting is blocked once an asset has any depreciation history (a
  403, mirroring the "can't delete something with real history"
  pattern used elsewhere), even though it's still `ACTIVE`.
- **Depreciation runs** (`depreciation_runs`) — a period (e.g. a
  month-end date): `DRAFT → POSTED`, or `CANCELLED` from `DRAFT`.
  **Depreciation lines** (`depreciation_lines`) are one row per asset
  per run, generated — not hand-entered — the same
  one-child-row-per-parent-entity convention as Payroll's Payslip.

### Generating: straight-line depreciation, grouped by category

`POST /assets/depreciation-runs/:id/generate` (`DRAFT` only) computes,
for every `ACTIVE` asset with remaining depreciable value,
`min(floor((purchaseCostCents - salvageValueCents) / usefulLifeMonths),
remainingDepreciableCents)` — capped so the last period never
depreciates past the salvage value — then groups the amounts by
category into one debit (expense account) / credit (accumulated
depreciation account) line pair per category in a single `POSTED`
`JournalEntry`, and updates each asset's running
`accumulatedDepreciationCents`. Any eligible asset whose category is
missing either mapped account fails the whole run with a 400 naming
the category, before anything is posted.

### Disposing: a four-line balanced entry with the resulting gain or loss

`POST /assets/assets/:id/dispose` (`ACTIVE` only) takes a
`disposalDate`, optional `disposalProceedsCents`, a `cashAccountId`
(required once proceeds are non-zero), and a `gainLossAccountId`. It
computes `netBookValueCents = purchaseCostCents -
accumulatedDepreciationCents` and `gainLossCents = proceedsCents -
netBookValueCents`, then posts: a debit to accumulated depreciation
(removing the contra-asset balance), a debit to cash for any proceeds,
a credit to the asset account for the original cost, and a debit
(loss) or credit (gain) to the caller's gain/loss account for the
difference — four lines that balance by construction, since
`accumDep + proceeds + max(0,-gainLoss) = cost + max(0,gainLoss)`
reduces to an identity given `netBookValue = cost - accumDep`.

`AssetsModule`'s controllers all sit under literal sub-paths
(`categories`, `assets`, `depreciation-runs`, `depreciation-lines`,
`reports`) — no controller claims the bare `assets` root, so the
Projects `:id`-wildcard-shadowing bug class is avoided by
construction, same as every module since.

### Reports

`GET /assets/reports/summary` (active/disposed counts, total purchase
cost, accumulated depreciation, and net book value across active
assets) and `GET /assets/reports/by-category` (active asset count and
net book value per category) — the latter aggregated in application
code since it needs a per-asset computed net-book-value sum, not a
plain column `groupBy`.

### Frontend

`apps/web/src/app/(dashboard)/assets/` — an overview (stat tiles plus
a net-book-value-by-category bar chart), a Categories page (with three
ledger-account pickers), an Assets page (register form plus an
inline per-row Dispose panel with date/proceeds/cash-account/
gain-loss-account inputs), and a Depreciation Runs page with a
click-to-expand row showing each posted line's amount and running
accumulated total, mirroring Payroll's Pay Runs page.

## Recruitment (Milestone 7l — twelfth business module)

Source: `apps/api/src/modules/recruitment/` (`job-postings/`,
`candidates/`, `applications/`, `interviews/`).

Job postings, candidates, and an application pipeline
(`APPLIED → SCREENING → INTERVIEWING → OFFERED → HIRED`, with
`REJECTED`/`WITHDRAWN` reachable from any non-terminal state) that
ends in a real cross-module conversion: hiring an application creates
an actual HR `Employee` record.

### Entities

- **Job postings** (`job_postings`) — `OPEN → CLOSED`, reopenable.
  Optionally tied to an HR `Department`.
- **Candidates** (`candidates`) — a simple contact record (name,
  email, phone, resume URL, source). Not unique on email — the same
  person can be represented by more than one record if entered twice,
  same as CRM's contacts.
- **Applications** (`applications`) — a `Candidate`'s application to a
  `JobPosting`, unique per (posting, candidate) pair. Each pipeline
  step (`screen`, `interview`, `offer`, `reject`, `withdraw`, `hire`)
  is a dedicated action validating the application is in the correct
  prior state, rather than a free-form status `PATCH`.
- **Interviews** (`interviews`) — scheduled rounds against an
  Application (`SCHEDULED → COMPLETED`, or `CANCELLED`), each with an
  optional HR `Employee` interviewer, a stage label, and
  feedback/rating captured on completion.

### Hiring: a real cross-module conversion

`POST /recruitment/applications/:id/hire` (`OFFERED` only) is a
dedicated action with a real side effect — creating an HR `Employee`
record — the same precedent as Purchase's `receive()` and Payroll's
`generate()`. It's written via a direct `tx.employee.create` call
inside a transaction rather than injecting `HrModule`'s service, the
same cross-module `tx.*` convention Purchase uses for Inventory. The
new employee's name/email/phone come from the `Candidate`; job title
and employment type default to the `JobPosting`'s (overridable in the
request body); department defaults to the posting's department. The
application is stamped `HIRED` with `hiredEmployeeId` pointing at the
new employee — a second `hire` call on the same application is
rejected with a 400, since it's no longer `OFFERED`.

`RecruitmentModule`'s controllers all sit under literal sub-paths
(`job-postings`, `candidates`, `applications`, `interviews`,
`reports`) — no controller claims the bare `recruitment` root, so the
Projects `:id`-wildcard-shadowing bug class is avoided by
construction, same as every module since.

### Reports

`GET /recruitment/reports/summary` (open posting count, active
application count, scheduled interview count, and hired-all-time
count) and `GET /recruitment/reports/applications-by-status`.

### Frontend

`apps/web/src/app/(dashboard)/recruitment/` — an overview (stat tiles
plus an applications-by-status bar chart), a Job Postings page (create
form plus per-row Close/Reopen), a Candidates page, and an Applications
page with a click-to-expand row showing notes/rejection reason/hired-
employee reference and that application's scheduled interviews,
per-row pipeline action buttons (Screen/Move to interviewing/Offer),
and inline Reject (reason input) and Hire (date/salary/department
inputs) panels.

## Contracts (Milestone 7m — thirteenth business module)

Source: `apps/api/src/modules/contracts/`.

A single-resource module: contracts with a counterparty (a CRM
`Account`), moving `DRAFT → ACTIVE → EXPIRED` or `TERMINATED`, or
`RENEWED` via a dedicated action that creates a linked successor
contract rather than mutating the original's dates.

### Entities

- **Contracts** (`contracts`) — `contractNumber` (`CON-000001`-style,
  via the shared `formatDocumentNumber` util), a type
  (`SALES`/`PURCHASE`/`SERVICE`/`EMPLOYMENT`/`NDA`/`OTHER`), an
  optional counterparty `Account` and `owner` (defaults to the
  creating user), value/currency, a start/end date range, and an
  `autoRenew`/`renewalTermMonths` hint pair. Only a `DRAFT` contract
  can be edited or deleted.

### Workflow: activate, terminate, expire, renew

- `POST /contracts/:id/activate` — `DRAFT → ACTIVE`.
- `POST /contracts/:id/terminate` — `ACTIVE → TERMINATED`, requires a
  `terminationReason` (1-500 chars), stamps `terminatedAt`.
- `POST /contracts/:id/expire` — `ACTIVE → EXPIRED`.
- `POST /contracts/:id/renew` — `ACTIVE` only; validates the new
  `endDate` is after the current contract's `endDate`. Rather than
  mutating the expiring contract's dates in place, it creates a new
  successor `Contract` inside a transaction (`parentContractId`
  pointing back at the original; `startDate` = the original's
  `endDate`; `valueCents` defaults to the original's unless
  overridden) and flips the original to a terminal `RENEWED` status.
  This is the same "conversion creates a new linked record" precedent
  as CRM's lead conversion and Recruitment's `hire()`. The 1:1
  self-relation is enforced by `parentContractId`'s `@unique`
  constraint, so each contract has at most one direct successor,
  readable from either side (`parentContract` /
  `renewedAsContract`).

Comments and attachments are reused directly from the generic
polymorphic system (`entityType: "Contract"`) — no module-specific
code was needed for either.

`ContractsModule` registers `ContractsReportsController`
(`contracts/reports/*`, 3 path segments) before `ContractsController`
(whose `contracts/:id` is a 2-segment wildcard). A 3-segment path can
never actually collide with a 2-segment wildcard regardless of
registration order, but the ordering still follows the same
literal-before-wildcard discipline established after the Projects
routing bug, as belt-and-suspenders.

### Reports

`GET /contracts/reports/summary` (draft count, active count, count
expiring within 30 days, total active value) and
`GET /contracts/reports/by-status` (a count per `ContractStatus`).

### Frontend

`apps/web/src/app/(dashboard)/contracts/` — a single combined page (no
subnav, since Contracts is a lean single-resource module) with stat
tiles, a contracts-by-status bar chart, search/status filtering, a
collapsible create form, and a list linking into a detail page
(`contracts/[id]`) with status-gated action buttons (Activate; or
Renew/Terminate/Mark expired while active), inline confirm panels for
renew and terminate, and the shared `CommentsPanel`/`AttachmentsPanel`
components.

## Manufacturing (Milestone 7n — fourteenth business module)

Source: `apps/api/src/modules/manufacturing/` (`boms/`,
`work-orders/`).

Bills of material and the work orders that produce against them,
closing the loop on Inventory: a work order's `start` consumes
component stock and its `complete` produces finished-good stock, both
posted as real `StockMovement` rows.

### Entities

- **Bills of material** (`bills_of_material` + `bom_lines`) — a
  recipe: a finished-good `Product`, a name, an `isActive` flag, and
  one or more component lines (`componentProduct` + `quantity`
  consumed per one unit of the finished product). A product cannot be
  a component of its own BOM. Lines are a real relational child table
  (not a JSON snapshot, unlike Sales/Purchase line items) because a
  BOM is a living recipe meant to be edited — `PATCH` with a `lines`
  array fully replaces the existing lines inside a transaction, the
  same nested-`create` pattern Accounting's `JournalEntry` uses for
  its lines.
- **Work orders** (`work_orders`) — `workOrderNumber` (`WO-000001`-
  style), a reference to the `BillOfMaterial`, a denormalized
  `productId` (copied from the BOM at creation), a target `warehouse`,
  and a planned `quantity`. Moves `DRAFT → IN_PROGRESS → COMPLETED`,
  or `CANCELLED` (only reachable from `DRAFT`, since nothing has been
  consumed yet to reverse). Only a `DRAFT` work order can be edited or
  deleted.

### Workflow: start and complete

- `POST /manufacturing/work-orders/:id/start` (`DRAFT` only) —
  transactionally consumes each BOM line's component stock (that
  line's `quantity` times the work order's own `quantity`) at the work
  order's warehouse, posting a `PRODUCTION_CONSUME` `StockMovement`
  per component. Reuses the exact "Insufficient stock: X on hand,
  cannot move Y" guard Inventory's own manual movement recording uses
  — if any component would go negative, the whole transaction rolls
  back and no partial consumption is left behind.
- `POST /manufacturing/work-orders/:id/complete` (`IN_PROGRESS` only)
  — the counterpart action: posts the finished product's yield (the
  work order's `quantity`) into the same warehouse as a
  `PRODUCTION_YIELD` `StockMovement`, the same "reuse Inventory's own
  movement-recording logic" convention Purchase's `receive()`
  established.
- `POST /manufacturing/work-orders/:id/cancel` (`DRAFT` only).

`StockMovementType` gained two new values for this milestone,
`PRODUCTION_CONSUME` and `PRODUCTION_YIELD`, so a warehouse manager can
distinguish a stock change caused by production from one caused by a
sale, a purchase receipt, or a manual adjustment.

`ManufacturingModule`'s controllers all sit under literal sub-paths
(`boms`, `work-orders`, `reports`) — no controller claims the bare
`manufacturing` root, so the Projects `:id`-wildcard-shadowing bug
class is avoided by construction, same as every module since.

### Reports

`GET /manufacturing/reports/summary` (draft/in-progress/completed work
order counts, active BOM count, and total completed quantity
all-time) and `GET /manufacturing/reports/by-status` (a count per
`WorkOrderStatus`).

### Frontend

`apps/web/src/app/(dashboard)/manufacturing/` — an overview (stat
tiles plus a work-orders-by-status bar chart), a Bills of Material
page (create form with a dynamic add/remove component-line editor, and
a click-to-expand row showing each line's component and quantity), and
a Work Orders page (create form plus per-row Start/Cancel while draft
or Complete while in progress, mirroring Recruitment's Job Postings
per-row action-button pattern).

## Point of Sale (Milestone 7o — fifteenth business module)

Source: `apps/api/src/modules/pos/` (`sessions/`, `sales/`).

Register sessions and the sales rung up against them. Unlike every
other document in this codebase, a `PosSale` has no draft stage —
ringing one up deducts stock immediately — and a session's `close`
introduces the standard till-reconciliation workflow (counted cash vs.
expected cash).

### Entities

- **Register sessions** (`pos_register_sessions`) — a cashier's shift
  at a warehouse: `sessionNumber` (`REG-000001`-style), an opening
  cash float, `OPEN → CLOSED`. Only one `OPEN` session is allowed per
  warehouse at a time.
- **Sales** (`pos_sales`) — `saleNumber` (`POS-000001`-style), a JSON
  line-item snapshot (the same `LineItemDto`/`priceLineItems` shared
  utility Sales and Purchase use), a `paymentMethod` (the existing
  `PaymentMethod` enum, reused as-is rather than duplicated — "how
  money changed hands" is genuinely the same concept whether it's
  Accounting settling an invoice or a register sale), and for `CASH`
  sales an `amountTenderedCents`/`changeDueCents` pair.
  `COMPLETED → VOIDED` or `REFUNDED`.

### Workflow: ring up, void, refund, and reconcile

- `POST /pos/sales` (open session only) — transactionally deducts
  each line item's component stock at the session's warehouse, the
  same "Insufficient stock" guard and `StockMovement`-posting
  convention every stock-moving action in this codebase follows,
  posting the existing `SALE` type. A `CASH` sale requires
  `amountTenderedCents` to be at least the total; change due is
  computed and stored.
- `POST /pos/sales/:id/void` (`COMPLETED`, and only while its session
  is still `OPEN`) and `POST /pos/sales/:id/refund` (`COMPLETED`,
  any time) both restock the items via the existing `RETURN` type —
  two distinct real-world reasons a sale unwinds (an immediate
  same-shift correction vs. a later customer return), the same
  "multiple terminal outcomes from one active state" shape as
  Contracts' `terminate`/`expire`.
- `POST /pos/sessions/:id/close` — counts the drawer. Expected cash is
  the opening float plus every still-`COMPLETED` cash sale in the
  session (a voided or refunded sale no longer counts, since the cash
  that came in when it was rung up was handed back out); the
  difference against counted cash is stored on the session for
  reporting.

No new `StockMovementType` values were needed — `SALE` and `RETURN`
already existed and fit exactly.

`PosModule`'s controllers all sit under literal sub-paths (`sessions`,
`sales`, `reports`) — no controller claims the bare `pos` root, so the
Projects `:id`-wildcard-shadowing bug class is avoided by
construction, same as every module since.

### Reports

`GET /pos/reports/summary` (open session count, completed/voided/
refunded sale counts, total completed sales value) and
`GET /pos/reports/by-payment-method` (completed sale count and value
per `PaymentMethod`).

### Frontend

`apps/web/src/app/(dashboard)/pos/` — an overview (stat tiles plus a
by-payment-method bar chart), a Register page (the actual checkout
screen: open-session form when none is active, otherwise a product
picker building a local cart, a checkout panel with live change-due
calculation, and a close-register panel showing the reconciliation
result), and a Sales page (history list with per-row Void/Refund
reason-input panels, mirroring Contracts' inline-panel pattern).

## Attendance (Milestone 7p — sixteenth business module)

Source: `apps/api/src/modules/attendance/`.

One row per `Employee` per calendar day. Unlike every prior module,
its two reports are deliberately day-scoped (today only) rather than
all-time — the operationally relevant question for attendance is
"who's in right now," not a running total.

### Entities

- **Attendance records** (`attendance_records`) — a `date`, optional
  `clockInAt`/`clockOutAt`, a `status`
  (`PRESENT`/`LATE`/`HALF_DAY`/`ABSENT`/`ON_LEAVE`), and
  `workedMinutes` once clocked out. Unique per
  `(employeeId, date)` — there is exactly one record per employee per
  day, upserted into by both `clock-in` and `mark`.

### Workflow: clock in, clock out, and mark

- `POST /attendance/clock-in` (`{ employeeId }`) — upserts today's
  record and stamps `clockInAt`, auto-detecting `LATE` against a
  fixed cutoff hour (the same "hardcoded business-rule constant"
  convention as Contracts' 30-day expiring-soon window). Rejects a
  second clock-in the same day.
  `POST /attendance/:id/clock-out` stamps `clockOutAt` and computes
  `workedMinutes`; rejects clocking out before clocking in, or twice.
- `POST /attendance/mark` (`{ employeeId, date, status, note? }`) —
  sets a day's status directly for days with no clock event (a
  no-show, an approved leave day, a half-day), rejecting `PRESENT`/
  `LATE` (those require an actual clock timestamp, so they can only
  be reached through `clock-in`). Upserts the same
  `(employeeId, date)` row `clock-in` would, so correcting a mark by
  re-marking the same day (e.g. `ABSENT` → `ON_LEAVE`) works, and
  marking clears any stale `clockInAt`/`clockOutAt`/`workedMinutes`.

`AttendanceModule` registers `AttendanceReportsController`
(`attendance/reports/*`, 3 path segments) before `AttendanceController`
(whose `attendance/:id` is a 2-segment wildcard) — belt-and-suspenders,
the same reasoning as Contracts' reports controller, since a
3-segment path can never actually collide with a 2-segment wildcard.

### Reports

`GET /attendance/reports/summary` (today's present/late/absent/
on-leave counts, plus the active employee count) and
`GET /attendance/reports/by-status` (today's count per
`AttendanceStatus`).

### Frontend

`apps/web/src/app/(dashboard)/attendance/` — a single combined page
(no subnav, since Attendance is a lean single-resource module like
Contracts) with today's stat tiles, a by-status bar chart, a clock-in
form, a mark-absence/leave/half-day form, and a list with a per-row
Clock out button for any record that's clocked in but not yet clocked
out.

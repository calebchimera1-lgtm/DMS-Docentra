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

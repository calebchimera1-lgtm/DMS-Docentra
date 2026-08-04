# Omniflow — Current Database ER Diagram

Generated from the live PostgreSQL schema (`omniflow`), 76 base tables,
187 foreign keys, 22 applied migrations. This documents **what exists
today**, not a proposed design.

## Tenancy topology

64 of the 76 tables carry a `company_id` FK pointing at `companies`,
which is the tenant root. The 12 that do not are listed under
"Tables without `company_id`" below, each with the reason.

```mermaid
erDiagram
    COMPANIES ||--o{ BRANCHES : has
    COMPANIES ||--o{ USERS : employs
    COMPANIES ||--o{ ROLES : defines
    COMPANIES ||--o{ SETTINGS : configures
    COMPANIES ||--o{ AUDIT_LOGS : records
    COMPANIES ||--o{ COMPANY_PLUGINS : installs

    USERS ||--o{ SESSIONS : opens
    USERS ||--o{ USER_ROLES : assigned
    USERS ||--o{ USER_BRANCHES : "scoped to"
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ MFA_BACKUP_CODES : has
    USERS ||--o{ PASSWORD_RESET_TOKENS : has
    USERS ||--o{ EMAIL_VERIFICATION_TOKENS : has

    ROLES ||--o{ ROLE_PERMISSIONS : grants
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : "granted by"
    ROLES ||--o{ USER_ROLES : "held via"
    BRANCHES ||--o{ USER_ROLES : "optionally scopes"
    BRANCHES ||--o{ USER_BRANCHES : "member of"

    PLUGINS ||--o{ COMPANY_PLUGINS : "installed as"
```

`PERMISSIONS` and `PLUGINS` are **global** (no `company_id`) — they are
catalogue tables. Tenant binding happens through `ROLE_PERMISSIONS` and
`COMPANY_PLUGINS` respectively.

## Order-to-cash cluster (as currently wired)

```mermaid
erDiagram
    CRM_ACCOUNTS ||--o{ QUOTES : "quoted to"
    CRM_ACCOUNTS ||--o{ SALES_ORDERS : "ordered by"
    CRM_ACCOUNTS ||--o{ INVOICES : "billed to"
    CRM_CONTACTS }o--|| CRM_ACCOUNTS : "belongs to"

    QUOTES ||--o| SALES_ORDERS : "converts to"
    SALES_ORDERS ||--o| INVOICES : "converts to"
    INVOICES ||--o{ PAYMENTS : "settled by"

    PRODUCTS ||--o{ STOCK_ITEMS : "stocked as"
    WAREHOUSES ||--o{ STOCK_ITEMS : holds
    PRODUCTS ||--o{ STOCK_MOVEMENTS : moves
    WAREHOUSES ||--o{ STOCK_MOVEMENTS : "records at"

    LEDGER_ACCOUNTS ||--o{ JOURNAL_LINES : "posted to"
    JOURNAL_ENTRIES ||--o{ JOURNAL_LINES : contains
```

**Gap visible in this diagram:** there is no edge from `SALES_ORDERS` or
`INVOICES` to `STOCK_MOVEMENTS`, and none from `INVOICES` to
`JOURNAL_ENTRIES`. Sales is structurally disconnected from Inventory and
Accounting — confirmed empirically in the end-to-end test.

## Modules that DO write into shared ledgers

```mermaid
erDiagram
    POS_SALES ||--o{ STOCK_MOVEMENTS : "deducts via"
    GOODS_RECEIPTS ||--o{ STOCK_MOVEMENTS : "receives via"
    WORK_ORDERS ||--o{ STOCK_MOVEMENTS : "consumes/yields via"
    SHIPMENTS ||--o{ STOCK_MOVEMENTS : "dispatches via"

    EXPENSE_CLAIMS ||--o{ JOURNAL_ENTRIES : posts
    DEPRECIATION_RUNS ||--o{ JOURNAL_ENTRIES : posts
    ASSETS ||--o{ JOURNAL_ENTRIES : "disposal posts"

    SUBSCRIPTIONS ||--o{ SUBSCRIPTION_INVOICES : bills
    SUBSCRIPTION_INVOICES ||--|| INVOICES : "raises"
```

## Cross-module reference edges

```mermaid
erDiagram
    SHIPMENTS }o--o| VEHICLES : "carried by"
    SHIPMENTS }o--o| TRIPS : "opens"
    SHIPMENTS }o--o| SALES_ORDERS : fulfils
    VEHICLES }o--o| EMPLOYEES : "driven by"
    TRIPS }o--o| EMPLOYEES : "driven by"
    MAINTENANCE_RECORDS }o--|| VEHICLES : services

    APPLICATIONS }o--|| JOB_POSTINGS : "applies to"
    APPLICATIONS }o--|| CANDIDATES : from
    APPLICATIONS }o--o| EMPLOYEES : "hires into"
    INTERVIEWS }o--|| APPLICATIONS : assesses

    PROJECTS }o--o| CRM_ACCOUNTS : "for client"
    PROJECT_TASKS }o--|| PROJECTS : "belongs to"
    TIME_ENTRIES }o--o| PROJECT_TASKS : logs

    DOCUMENTS }o--o| DOCUMENT_FOLDERS : "filed in"
    DOCUMENT_FOLDERS }o--o| DOCUMENT_FOLDERS : "nested in"
    DOCUMENT_VERSIONS }o--|| DOCUMENTS : "revision of"

    SUBSCRIPTIONS }o--|| SUBSCRIPTION_PLANS : "on plan"
    SUBSCRIPTIONS }o--|| CRM_ACCOUNTS : "sold to"
```

## Tables without `company_id` (12)

| Table | Reason | Verdict |
|---|---|---|
| `companies` | is the tenant root | correct |
| `permissions` | global catalogue | correct |
| `plugins` | global catalogue | correct |
| `_prisma_migrations` | tooling | correct |
| `role_permissions` | junction; scoped via `roles.company_id` | acceptable |
| `user_roles` | junction; scoped via `users.company_id` | acceptable |
| `user_branches` | junction; scoped via `users.company_id` | acceptable |
| `bom_lines` | child; scoped via `bills_of_material.company_id` | acceptable, no defence in depth |
| `journal_lines` | child; scoped via `journal_entries.company_id` | acceptable, no defence in depth |
| `sessions` | has `company_id`… **it does** (verified) | correct |
| `mfa_backup_codes` | scoped via `users` | acceptable |
| `password_reset_tokens` / `email_verification_tokens` | scoped via `users` | acceptable |

## Polymorphic (untyped) relationships

`attachments` and `comments` address their parent via
`(entity_type, entity_id)` with **no foreign key**. They carry
`company_id`, so cross-tenant reads are impossible, but:

- nothing prevents writing a comment against a non-existent or
  wrong-module `entity_id`;
- deleting a parent record leaves its comments and attachments behind
  (no cascade is possible without a real FK).

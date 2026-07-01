# Docentra Architecture

## Overview

Docentra is a multi-tenant (single organization per account, many organizations
per deployment) Enterprise Content Management platform composed of three
independently deployable applications sharing one REST API:

```
                        ┌─────────────────────┐
                        │   PostgreSQL 16      │
                        │  (Prisma schema)     │
                        └──────────▲───────────┘
                                   │
┌───────────────┐        ┌────────┴─────────┐        ┌───────────────────┐
│  React Web    │◄──────►│  Node/Express API │◄──────►│  Flutter Mobile   │
│  (Vite, SPA)  │  HTTP  │  + Socket.IO      │  HTTP  │  (Android & iOS)  │
└───────────────┘        └────────┬─────────┘        └───────────────────┘
                                   │
                         ┌─────────┴─────────┐
                         │ Local disk  or S3 │
                         │ (MinIO in Docker) │
                         └───────────────────┘
```

- **Backend**: Node.js + TypeScript + Express + Prisma ORM, PostgreSQL.
- **Web**: React 18 + TypeScript + Vite, talks to the same REST API.
- **Mobile**: Flutter (Dart), talks to the same REST API.
- **Storage**: pluggable driver — local disk by default, S3-compatible
  (AWS S3 or MinIO) via `STORAGE_DRIVER=s3`. Files are AES-256-GCM encrypted
  before being written to either backend.
- **Real-time**: Socket.IO pushes notification events to connected web/mobile
  clients (JWT-authenticated on the socket handshake).

## Backend module layout

```
backend/src/
  config/        env, logger, prisma client, permission registry
  middleware/    auth (JWT), RBAC (requirePermission/requireRole), validation, error handling
  modules/
    auth/         register, login, MFA (TOTP + backup codes), sessions, password reset
    users/        user CRUD, role assignment, activity history, temporary access
    organizations/ org settings, branches, departments, roles & permissions admin
    documents/    folders, documents, versions, uploads, recycle bin, tags,
                  comments, favorites, share links
    search/       OCR/text extraction pipeline + full-text/metadata search + saved searches
    workflow/     workflow templates, instances, step routing, approve/reject/delegate
    signatures/   signature requests, signing, hash-based integrity verification
    notifications/ in-app + email + socket.io delivery
    audit/        audit log query + CSV export
    dashboard/    personal + executive + compliance analytics
  sockets/       Socket.IO server wiring (auth, per-user/org rooms)
  utils/         ApiError, asyncHandler, storage driver, encryption, audit recorder, email
```

Every module follows the same three-file pattern: `*.routes.ts` (Express
router + validation + permission gates) → `*.controller.ts` (thin HTTP
adapters) → `*.service.ts` (business logic, the only layer that touches
Prisma).

## Data model (Prisma)

Key entities and relationships (see `backend/prisma/schema.prisma` for the
full, authoritative schema):

- **Organization** → Branches → Departments → Users (multi-tenant hierarchy)
- **Role** ↔ **Permission** (many-to-many via `RolePermission`), **User** ↔
  **Role** (many-to-many via `UserRole`) — this is the RBAC core.
- **Folder** (self-referential, materialized `path` for breadcrumb/subtree
  queries) contains **Document**s.
- **Document** has many **DocumentVersion**s (version history), **Tag**s
  (via `DocumentTag`), **DocumentMetadata** (custom fields), **Comment**s,
  **Favorite**s, and **ShareLink**s. Soft-deleted via `deletedAt` for the
  recycle bin; `permanentlyDeletedAt` reserved for retention-driven purges.
- **WorkflowTemplate** → **WorkflowStep**s (ordered, each bound to either a
  role or a specific user as approver) → **WorkflowInstance** (one per
  document workflow run) → **WorkflowStepInstance** (one per eligible
  approver per step, resolved to APPROVED/REJECTED/SKIPPED/DELEGATED).
- **SignatureRequest** → **Signature** (one per signatory), each signature
  stores a SHA-256 hash of `documentId + signerId + content + timestamp` for
  tamper-evidence.
- **AuditLog** and **Notification** are written by nearly every mutating
  action across modules.

## Security model

- Access tokens are short-lived JWTs (15m default) carrying `sub`, `organizationId`,
  `sessionId`, `roles`, and a flattened `permissions` array — permission
  checks are O(1) array lookups in middleware, no per-request DB query.
- Refresh tokens are opaque random values, stored **hashed** (SHA-256) in
  `refresh_tokens`, single-use (rotated on every refresh), and tied to a
  `Session` row that can be individually revoked (device/session management).
- Passwords: bcrypt (cost configurable, default 12), enforced policy (length,
  upper/lower/digit/special), account lockout after 5 failed attempts (15 min).
- MFA: TOTP (RFC 6238) via `speakeasy`, plus one-time backup codes.
- File encryption: AES-256-GCM at rest, applied by the storage layer
  regardless of backend (local disk or S3), so a compromised bucket/disk
  does not expose plaintext documents.
- All mutating requests are attributed and written to `audit_logs` with
  actor, IP, user agent, resource type/id.

## What is intentionally out of scope for this build

This specification requests several hundred discrete features spanning a
category most enterprise ECM vendors ship as separate paid modules after
years of development (LDAP/AD federation, GraphQL API, blockchain audit
trail, biometric/facial recognition, CAD file rendering, ERP/CRM/Slack/Teams
integrations, physical records/RFID tracking, predictive analytics, etc.).
This build implements a genuinely functional, tested core across every major
category in the spec (auth/RBAC/MFA, document lifecycle, OCR/search,
workflow, e-signatures, notifications, audit, dashboards, admin, mobile,
Docker deployment) rather than stubbing all ~500 bullets shallowly. See the
"Roadmap / Not Implemented" section in the root README for the explicit list.

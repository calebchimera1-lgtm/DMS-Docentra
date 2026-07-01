# DOCENTRA

**Enterprise Document Management System** — a document lifecycle, workflow,
and compliance platform built with a Node.js/Express + PostgreSQL backend, a
React web application, and a Flutter mobile client.

> **Scope note.** The full product specification for this project lists
> several hundred discrete features across 26 categories — the kind of
> surface area enterprise ECM vendors (OpenText, M-Files, DocuWare) build out
> over years with full engineering teams. Rather than stub every bullet
> shallowly, this build implements a **real, tested, end-to-end core** across
> every major category — see [What's implemented](#whats-implemented) and
> [Roadmap](#roadmap--not-implemented) below for the explicit line between
> the two.

## What's implemented

Fully functional and covered by automated tests + a live manual verification
pass (backend integration tests + a scripted browser walkthrough of the web
app), unless noted otherwise:

- **Auth & Identity**: registration (creates an org + Super Admin), login,
  JWT access + rotating refresh tokens, TOTP MFA with backup codes, password
  policy enforcement, account lockout after failed attempts, session/device
  management with remote revocation, password reset via email.
- **RBAC**: roles, granular permissions, a role↔permission matrix editor,
  department/branch org hierarchy, per-resource temporary access grants.
- **Documents**: upload (single + bulk), nested folders, rename/move/copy/
  delete, recycle bin + restore + permanent delete, checksum-based duplicate
  detection, check-in/check-out locking, full version history with restore
  and diff/comparison, tags, custom metadata fields, comments (with
  `@mention` notifications), favorites, password-protected/expiring/
  download-limited public share links, AES-256-GCM encryption at rest,
  optional PDF watermarking on download.
- **OCR & Search**: `tesseract.js` OCR for images, PDF text-layer extraction,
  plain-text/CSV/JSON/XML/HTML indexing — all feeding a full-text search
  across name/description/content/tags/author/department/date/file type,
  plus saved searches.
- **Workflow automation**: multi-step, multi-level approval templates routed
  by role or specific user, approve/reject/delegate, SLA due dates,
  automatic notifications to approvers and initiators.
- **E-Signatures**: multi-signatory requests, drawn or typed signatures,
  SHA-256 integrity hash recorded at signing time with a verification
  endpoint.
- **Notifications**: in-app + email (SMTP via `nodemailer`) + real-time
  push over Socket.IO.
- **Audit log**: every mutating action recorded with actor/IP/user-agent/
  resource, filterable, CSV export.
- **Dashboards**: personal dashboard (recent/favorite docs, pending
  approvals/signatures, storage usage, activity feed) and an executive
  analytics dashboard (workflow breakdown, documents by type, department
  headcount, storage forecasting inputs).
- **Admin**: user management, roles/permissions, branches, departments,
  organization settings.
- **Storage**: pluggable local-disk or S3-compatible (AWS S3 / MinIO) driver.
- **Web app**: React 18 + TypeScript SPA covering every module above.
- **Mobile app**: Flutter client (Dart source — see
  [mobile/README.md](mobile/README.md) for a note on platform scaffolding)
  covering login+MFA, folder browsing, camera-scan/gallery/file upload,
  offline-cached document listing, check-in/out, approvals, e-signature
  signing, and notifications.
- **Deployment**: Docker Compose stack (PostgreSQL, MinIO, backend, web via
  Nginx) — see [Docker caveat](#docker-caveat-in-this-development-session).

## Roadmap / not implemented

Explicitly out of scope for this build (would each be a substantial project
on their own): SSO/LDAP/Active Directory federation, biometric/facial/
fingerprint login, blockchain audit trail, GraphQL API, native SDKs/developer
sandbox/webhooks, Microsoft 365/Google Workspace/Teams/Slack/WhatsApp/CRM/ERP
integrations, CAD/AutoCAD rendering, handwriting/ID/passport/invoice
recognition beyond generic OCR, AI contract analysis/risk detection/
translation/sentiment analysis, physical records/barcode/RFID tracking,
multi-cloud/CDN/edge storage, client/vendor portals, real-time collaborative
document editing, and high-availability clustering/load balancing. Several of
these have data-model or API hooks already in place (e.g. `RetentionPolicy`,
`Confidentiality` levels) that a follow-up phase could build on.

## Repository layout

```
DMS-Docentra/
  backend/    Node.js + Express + TypeScript + Prisma/PostgreSQL API
  web/        React + TypeScript + Vite SPA
  mobile/     Flutter (Dart) mobile client
  docs/       Architecture and API reference
  docker-compose.yml, .env.example   Full-stack deployment
```

Each app has its own `README`/`.env.example` with app-specific detail.

## Getting started (local development, no Docker)

Prerequisites: Node.js 20+, PostgreSQL 14+ running locally.

```bash
# 1. Backend
cd backend
cp .env.example .env            # edit DATABASE_URL / JWT secrets as needed
npm install
npx prisma migrate dev          # creates the schema
npx ts-node --transpile-only prisma/seed.ts   # optional: seed a demo org
npm run dev                     # http://localhost:4000

# 2. Web app (separate terminal)
cd web
cp .env.example .env
npm install
npm run dev                     # http://localhost:5173
```

Seeded demo login (after running the seed script): organization slug
`docentra-demo`, email `admin@docentra-demo.com`, password `Admin@12345`.

### Mobile

The Flutter SDK is not available in the environment this project was built
in, so `mobile/` contains complete Dart source but not the generated native
`android/`/`ios/` project folders. See [mobile/README.md](mobile/README.md)
for the one-time `flutter create .` step to scaffold them.

## Running with Docker Compose

```bash
cp .env.example .env   # edit secrets before any non-local deployment
docker compose up --build
```

This starts PostgreSQL, MinIO (S3-compatible storage, with an init step that
creates the bucket), the backend API (runs `prisma migrate deploy` on boot),
and the web app served by Nginx (which reverse-proxies `/api` and
`/socket.io` to the backend). Web UI: `http://localhost:8080`. MinIO console:
`http://localhost:9001`.

### Docker caveat in this development session

The Dockerfiles and `docker-compose.yml` were written following standard
multi-stage build practice and validated with `docker compose config` (which
parses and fully resolves the compose file). However, **this sandboxed
development session's network policy blocks pulls from Docker Hub**
(`docker.io` / its CloudFront CDN returned policy-denied 403s when this was
attempted), so `docker compose up --build` could not be executed end-to-end
here to confirm the images actually build and boot. Test this in an
environment with normal Docker Hub access before relying on it in production.

## Testing

```bash
# Backend: 20 Jest + Supertest integration tests against a real Postgres DB
cd backend
createdb docentra_test    # or point TEST_DATABASE_URL at an existing one
npm test

# Web: Vitest + Testing Library
cd web
npm test
```

The backend suite and the web app were both additionally verified manually
in this session: the backend via direct `curl` smoke tests of every module
(auth/MFA, documents/OCR/search, workflow approval, e-signature signing +
verification), and the web app via a scripted Playwright run driving a real
Chromium browser through registration → login → folder creation → upload →
OCR search → executive dashboard → admin users, confirming each screen
renders real data end-to-end.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — module layout, data model, security model
- [docs/API.md](docs/API.md) — REST endpoint reference
- [backend/.env.example](backend/.env.example), [web/.env.example](web/.env.example) — configuration

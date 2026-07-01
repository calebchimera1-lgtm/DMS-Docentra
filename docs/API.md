# Docentra REST API Reference

Base URL: `{APP_URL}/api/v1` (e.g. `http://localhost:4000/api/v1`)

All responses are JSON envelopes: `{ "success": boolean, "data"?: ..., "message"?: string }`.
Authenticated routes require `Authorization: Bearer <accessToken>`.

## Auth — `/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | - | Create a new organization + Super Admin user |
| POST | `/login` | - | Email/password login; returns tokens or an MFA challenge |
| POST | `/login/mfa` | - | Complete login with a TOTP/backup code |
| POST | `/refresh` | - | Exchange a refresh token for a new access/refresh pair |
| POST | `/logout` | JWT | Revoke the current session |
| POST | `/mfa/setup` | JWT | Generate a TOTP secret |
| POST | `/mfa/confirm` | JWT | Verify a code and enable MFA (returns backup codes) |
| POST | `/mfa/disable` | JWT | Disable MFA |
| POST | `/forgot-password` | - | Request a password reset email |
| POST | `/reset-password` | - | Reset password with a reset token |
| GET | `/me` | JWT | Current user profile + roles/permissions |
| GET | `/sessions` | JWT | List active sessions/devices |
| DELETE | `/sessions/:sessionId` | JWT | Revoke a specific session (remote logout) |

## Users — `/users` (requires `admin:users`)

`GET /`, `POST /`, `GET /:userId`, `PATCH /:userId`, `DELETE /:userId` (deactivate),
`PUT /:userId/roles`, `GET /:userId/activity`, `POST /:userId/temporary-access`.

## Organizations — `/organizations`

`GET /me`, `PATCH /me` (`admin:org_settings`); `GET/POST/PATCH/DELETE /branches`
and `/departments` (`admin:departments`); `GET/POST /roles`,
`PATCH /roles/:roleId/permissions`, `DELETE /roles/:roleId` (`admin:roles`);
`GET /permissions` (full permission registry, for building an admin UI).

## Folders — `/folders`

`GET /?parentId=` (list children; `root` for top level), `GET /:folderId/breadcrumb`,
`POST /`, `PATCH /:folderId/rename`, `PATCH /:folderId/move`, `PATCH /:folderId/archive`,
`DELETE /:folderId` (must be empty).

## Documents — `/documents`

| Method | Path | Description |
|---|---|---|
| GET | `/?folderId=&status=&category=` | List (paginated) |
| GET | `/favorites` | Current user's favorited documents |
| GET | `/recycle-bin` | Soft-deleted documents |
| GET | `/tags` | All tags in the organization |
| POST | `/upload` | Multipart upload (`file`, `folderId`, `description`, `category`, `tags`) |
| POST | `/bulk-upload` | Multipart, `files[]` |
| GET | `/:documentId` | Detail incl. versions, tags, comments, metadata |
| GET | `/:documentId/download?watermark=true` | Stream bytes (PDF watermarking optional) |
| PATCH | `/:documentId` | Rename/describe/categorize |
| PATCH | `/:documentId/move` | Change folder |
| POST | `/:documentId/copy` | Duplicate |
| DELETE | `/:documentId` | Soft delete → recycle bin |
| POST | `/:documentId/restore` | Restore from recycle bin |
| DELETE | `/:documentId/permanent` | Permanently delete (must be in recycle bin) |
| POST | `/:documentId/check-out` / `/check-in` | Locking for exclusive edit |
| POST | `/:documentId/versions` | Upload a new version (multipart) |
| GET | `/:documentId/versions` | Version history |
| POST | `/:documentId/versions/:versionNumber/restore` | Roll back (creates a new version) |
| GET | `/:documentId/versions/compare?v1=&v2=` | Size/checksum/time diff |
| POST | `/:documentId/favorite` | `{ favorite: boolean }` |
| POST | `/:documentId/comments` | `{ body }` (supports `@email` mentions → notification) |
| POST | `/:documentId/tags` / `DELETE /:documentId/tags/:tagId` | Tagging |
| POST | `/:documentId/metadata` | Custom metadata field |
| POST/GET/DELETE | `/:documentId/share-links` | Password/expiry/download-limited public links |
| GET | `/shared/:token?password=` | **Public**, unauthenticated share-link access |

## Search — `/search`

`GET /?q=&fileType=&tag=&category=&departmentId=&authorId=&folderId=&dateFrom=&dateTo=`
— full-text across name/description/OCR text/tags/author. `GET/POST/DELETE /saved`
for saved searches.

## Workflow — `/workflows`

`GET/POST /templates`, `PATCH /templates/:templateId`; `POST /instances`
(`{ documentId, templateId }`); `GET /instances/:instanceId`;
`GET /documents/:documentId/instances`; `GET /my-approvals`;
`POST /instances/:instanceId/steps/:stepInstanceId/action` (`{ action: 'APPROVE'|'REJECT', comment? }`);
`POST /steps/:stepInstanceId/delegate` (`{ toUserId }`).

## Signatures — `/signatures`

`POST /requests` (`{ documentId, signatoryUserIds: [] }`); `GET /requests/:requestId`;
`GET /my-pending`; `POST /:signatureId/sign` (`{ signatureImage? | typedName }`);
`POST /:signatureId/decline`; `GET /:signatureId/verify` (hash integrity check).

## Notifications — `/notifications`

`GET /?unreadOnly=&page=&pageSize=`; `POST /:notificationId/read`; `POST /read-all`.
Real-time delivery also arrives over Socket.IO as a `notification:new` event
(connect with `io(SOCKET_URL, { auth: { token: accessToken } })`).

## Audit — `/audit-logs` (requires `audit:view`)

`GET /?userId=&action=&resourceType=&dateFrom=&dateTo=`; `GET /export` (CSV).

## Dashboard — `/dashboard`

`GET /me` (personal summary); `GET /executive` (`reports:view`); `GET /compliance` (`reports:view`).

## Permission keys

See `backend/src/config/permissions.ts` for the full registry
(`document:*`, `folder:*`, `workflow:*`, `signature:*`, `admin:*`, `audit:view`,
`reports:view`) and the default role→permission matrix seeded for every new
organization (Super Admin, Admin, Manager, Employee, Auditor).

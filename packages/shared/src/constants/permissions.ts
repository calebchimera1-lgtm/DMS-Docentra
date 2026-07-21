/**
 * Canonical permission keys, shared between the API (guards/seed data) and
 * the web app (conditional UI rendering). Format: "<module>:<action>".
 */
export const PERMISSIONS = {
  USERS_READ: "users:read",
  USERS_WRITE: "users:write",
  USERS_DELETE: "users:delete",
  ROLES_MANAGE: "roles:manage",
  COMPANIES_MANAGE: "companies:manage",
  BRANCHES_MANAGE: "branches:manage",
  AUDIT_LOGS_READ: "audit_logs:read",
  SETTINGS_MANAGE: "settings:manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

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

export interface PermissionDefinition {
  key: PermissionKey;
  module: string;
  action: string;
  description: string;
}

/**
 * The full permission catalog, keyed by the same values as PERMISSIONS.
 * This is the single source of truth for what gets seeded into the
 * `permissions` table — both `packages/database/prisma/seed.ts` (used for
 * local/CI seeding) and the API's runtime permission-catalog seeder
 * (`apps/api`, so RBAC works even if `db:seed` was never run) read from
 * this list, so the two never drift apart.
 */
export const PERMISSION_CATALOG: PermissionDefinition[] = [
  { key: PERMISSIONS.USERS_READ, module: "users", action: "read", description: "View users" },
  {
    key: PERMISSIONS.USERS_WRITE,
    module: "users",
    action: "write",
    description: "Create and edit users",
  },
  {
    key: PERMISSIONS.USERS_DELETE,
    module: "users",
    action: "delete",
    description: "Delete or deactivate users",
  },
  {
    key: PERMISSIONS.ROLES_MANAGE,
    module: "roles",
    action: "manage",
    description: "Manage roles and permission assignments",
  },
  {
    key: PERMISSIONS.COMPANIES_MANAGE,
    module: "companies",
    action: "manage",
    description: "Manage company profile and lifecycle",
  },
  {
    key: PERMISSIONS.BRANCHES_MANAGE,
    module: "branches",
    action: "manage",
    description: "Manage branches",
  },
  {
    key: PERMISSIONS.AUDIT_LOGS_READ,
    module: "audit_logs",
    action: "read",
    description: "View audit logs",
  },
  {
    key: PERMISSIONS.SETTINGS_MANAGE,
    module: "settings",
    action: "manage",
    description: "Manage company settings",
  },
];

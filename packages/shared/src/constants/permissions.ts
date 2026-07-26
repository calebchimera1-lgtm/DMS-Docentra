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
  CRM_READ: "crm:read",
  CRM_WRITE: "crm:write",
  CRM_DELETE: "crm:delete",
  SALES_READ: "sales:read",
  SALES_WRITE: "sales:write",
  SALES_DELETE: "sales:delete",
  INVENTORY_READ: "inventory:read",
  INVENTORY_WRITE: "inventory:write",
  INVENTORY_DELETE: "inventory:delete",
  ACCOUNTING_READ: "accounting:read",
  ACCOUNTING_WRITE: "accounting:write",
  ACCOUNTING_DELETE: "accounting:delete",
  HR_READ: "hr:read",
  HR_WRITE: "hr:write",
  HR_DELETE: "hr:delete",
  PROJECTS_READ: "projects:read",
  PROJECTS_WRITE: "projects:write",
  PROJECTS_DELETE: "projects:delete",
  SUPPORT_READ: "support:read",
  SUPPORT_WRITE: "support:write",
  SUPPORT_DELETE: "support:delete",
  PURCHASE_READ: "purchase:read",
  PURCHASE_WRITE: "purchase:write",
  PURCHASE_DELETE: "purchase:delete",
  PAYROLL_READ: "payroll:read",
  PAYROLL_WRITE: "payroll:write",
  PAYROLL_DELETE: "payroll:delete",
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
  {
    key: PERMISSIONS.CRM_READ,
    module: "crm",
    action: "read",
    description: "View CRM accounts, contacts, leads, and deals",
  },
  {
    key: PERMISSIONS.CRM_WRITE,
    module: "crm",
    action: "write",
    description: "Create and edit CRM accounts, contacts, leads, and deals",
  },
  {
    key: PERMISSIONS.CRM_DELETE,
    module: "crm",
    action: "delete",
    description: "Delete CRM accounts, contacts, leads, and deals",
  },
  {
    key: PERMISSIONS.SALES_READ,
    module: "sales",
    action: "read",
    description: "View products, quotes, sales orders, and invoices",
  },
  {
    key: PERMISSIONS.SALES_WRITE,
    module: "sales",
    action: "write",
    description: "Create and edit products, quotes, sales orders, and invoices",
  },
  {
    key: PERMISSIONS.SALES_DELETE,
    module: "sales",
    action: "delete",
    description: "Delete products, quotes, sales orders, and invoices",
  },
  {
    key: PERMISSIONS.INVENTORY_READ,
    module: "inventory",
    action: "read",
    description: "View warehouses, stock levels, and stock movements",
  },
  {
    key: PERMISSIONS.INVENTORY_WRITE,
    module: "inventory",
    action: "write",
    description: "Create and edit warehouses and record stock movements",
  },
  {
    key: PERMISSIONS.INVENTORY_DELETE,
    module: "inventory",
    action: "delete",
    description: "Delete warehouses",
  },
  {
    key: PERMISSIONS.ACCOUNTING_READ,
    module: "accounting",
    action: "read",
    description: "View the chart of accounts, journal entries, and payments",
  },
  {
    key: PERMISSIONS.ACCOUNTING_WRITE,
    module: "accounting",
    action: "write",
    description: "Create ledger accounts, journal entries, and payments",
  },
  {
    key: PERMISSIONS.ACCOUNTING_DELETE,
    module: "accounting",
    action: "delete",
    description: "Delete ledger accounts and draft journal entries",
  },
  {
    key: PERMISSIONS.HR_READ,
    module: "hr",
    action: "read",
    description: "View departments, employees, and leave requests",
  },
  {
    key: PERMISSIONS.HR_WRITE,
    module: "hr",
    action: "write",
    description: "Create and edit departments, employees, and leave requests",
  },
  {
    key: PERMISSIONS.HR_DELETE,
    module: "hr",
    action: "delete",
    description: "Delete departments and employees",
  },
  {
    key: PERMISSIONS.PROJECTS_READ,
    module: "projects",
    action: "read",
    description: "View projects, tasks, and logged time",
  },
  {
    key: PERMISSIONS.PROJECTS_WRITE,
    module: "projects",
    action: "write",
    description: "Create and edit projects, tasks, and time entries",
  },
  {
    key: PERMISSIONS.PROJECTS_DELETE,
    module: "projects",
    action: "delete",
    description: "Delete projects, tasks, and time entries",
  },
  {
    key: PERMISSIONS.SUPPORT_READ,
    module: "support",
    action: "read",
    description: "View support tickets",
  },
  {
    key: PERMISSIONS.SUPPORT_WRITE,
    module: "support",
    action: "write",
    description: "Create and edit support tickets",
  },
  {
    key: PERMISSIONS.SUPPORT_DELETE,
    module: "support",
    action: "delete",
    description: "Delete support tickets",
  },
  {
    key: PERMISSIONS.PURCHASE_READ,
    module: "purchase",
    action: "read",
    description: "View suppliers, purchase orders, and goods receipts",
  },
  {
    key: PERMISSIONS.PURCHASE_WRITE,
    module: "purchase",
    action: "write",
    description: "Create and edit suppliers and purchase orders, and receive goods",
  },
  {
    key: PERMISSIONS.PURCHASE_DELETE,
    module: "purchase",
    action: "delete",
    description: "Delete suppliers and draft purchase orders",
  },
  {
    key: PERMISSIONS.PAYROLL_READ,
    module: "payroll",
    action: "read",
    description: "View salary components, pay runs, and payslips",
  },
  {
    key: PERMISSIONS.PAYROLL_WRITE,
    module: "payroll",
    action: "write",
    description: "Manage salary components and process pay runs",
  },
  {
    key: PERMISSIONS.PAYROLL_DELETE,
    module: "payroll",
    action: "delete",
    description: "Delete salary components and draft pay runs",
  },
];

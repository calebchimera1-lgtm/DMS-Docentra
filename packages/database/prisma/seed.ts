import { PrismaClient } from "../generated/client";
import { PERMISSIONS } from "@omniflow/shared";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_COMPANY_SLUG = "omniflow-demo";
const DEMO_ADMIN_EMAIL = "admin@omniflow-demo.com";
const DEMO_ADMIN_PASSWORD = "Admin@12345";

/** module:action -> human description, used to seed the permission catalog. */
const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  [PERMISSIONS.USERS_READ]: "View users",
  [PERMISSIONS.USERS_WRITE]: "Create and edit users",
  [PERMISSIONS.USERS_DELETE]: "Delete or deactivate users",
  [PERMISSIONS.ROLES_MANAGE]: "Manage roles and permission assignments",
  [PERMISSIONS.COMPANIES_MANAGE]: "Manage company profile and lifecycle",
  [PERMISSIONS.BRANCHES_MANAGE]: "Manage branches",
  [PERMISSIONS.AUDIT_LOGS_READ]: "View audit logs",
  [PERMISSIONS.SETTINGS_MANAGE]: "Manage company settings",
};

async function seedPermissionCatalog() {
  const permissions = Object.values(PERMISSIONS);

  for (const key of permissions) {
    const [module, action] = key.split(":") as [string, string];
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: {
        key,
        module,
        action,
        description: PERMISSION_DESCRIPTIONS[key],
      },
    });
  }

  return prisma.permission.findMany({ where: { key: { in: permissions } } });
}

async function main(): Promise<void> {
  const permissions = await seedPermissionCatalog();
  console.log(`Seeded ${permissions.length} permissions.`);

  const company = await prisma.company.upsert({
    where: { slug: DEMO_COMPANY_SLUG },
    update: {},
    create: {
      name: "Omniflow Demo Co.",
      slug: DEMO_COMPANY_SLUG,
      currency: "USD",
      timezone: "UTC",
      status: "ACTIVE",
    },
  });

  const headquarters = await prisma.branch.upsert({
    where: { companyId_code: { companyId: company.id, code: "HQ" } },
    update: {},
    create: {
      companyId: company.id,
      name: "Headquarters",
      code: "HQ",
      isHeadquarters: true,
      status: "ACTIVE",
      city: "Remote",
      country: "N/A",
    },
  });

  const superAdminRole = await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: "Super Admin" } },
    update: {},
    create: {
      companyId: company.id,
      name: "Super Admin",
      description: "Full access to every module and setting.",
      isSystem: true,
    },
  });

  await prisma.rolePermission.deleteMany({ where: { roleId: superAdminRole.id } });
  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({
      roleId: superAdminRole.id,
      permissionId: permission.id,
    })),
  });

  const employeeRole = await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: "Employee" } },
    update: {},
    create: {
      companyId: company.id,
      name: "Employee",
      description: "Read-only baseline access.",
      isSystem: true,
    },
  });

  const readOnlyPermission = permissions.find((p) => p.key === PERMISSIONS.USERS_READ);
  if (readOnlyPermission) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: employeeRole.id, permissionId: readOnlyPermission.id },
      },
      update: {},
      create: { roleId: employeeRole.id, permissionId: readOnlyPermission.id },
    });
  }

  const passwordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    update: {},
    create: {
      companyId: company.id,
      email: DEMO_ADMIN_EMAIL,
      passwordHash,
      firstName: "Ada",
      lastName: "Admin",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.userBranch.upsert({
    where: { userId_branchId: { userId: admin.id, branchId: headquarters.id } },
    update: {},
    create: { userId: admin.id, branchId: headquarters.id, isPrimary: true },
  });

  // Postgres treats NULL as distinct in unique constraints, so Prisma
  // doesn't support null in a compound-unique `where` — look the
  // company-wide grant up manually instead of using upsert.
  const existingSuperAdminGrant = await prisma.userRole.findFirst({
    where: { userId: admin.id, roleId: superAdminRole.id, branchId: null },
  });
  if (!existingSuperAdminGrant) {
    await prisma.userRole.create({
      data: { userId: admin.id, roleId: superAdminRole.id, branchId: null },
    });
  }

  console.log(`Seeded demo company "${company.name}" (${company.slug}).`);
  console.log(`Seeded demo admin login: ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

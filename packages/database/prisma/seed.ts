import { PrismaClient } from "../generated/client";
import { PERMISSION_CATALOG, PERMISSIONS } from "@omniflow/shared";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_COMPANY_SLUG = "omniflow-demo";
const DEMO_ADMIN_EMAIL = "admin@omniflow-demo.com";
const DEMO_ADMIN_PASSWORD = "Admin@12345";

async function seedPermissionCatalog() {
  for (const definition of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: definition.key },
      update: { module: definition.module, action: definition.action, description: definition.description },
      create: definition,
    });
  }

  return prisma.permission.findMany({
    where: { key: { in: PERMISSION_CATALOG.map((p) => p.key) } },
  });
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

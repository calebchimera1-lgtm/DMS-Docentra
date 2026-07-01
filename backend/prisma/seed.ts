import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ROLE_PERMISSION_MAP, SYSTEM_ROLES } from '../src/config/permissions';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.organization.findUnique({ where: { slug: 'docentra-demo' } });
  if (existing) {
    console.log('Demo organization already seeded, skipping.');
    return;
  }

  const organization = await prisma.organization.create({
    data: { name: 'Docentra Demo Corp', slug: 'docentra-demo' },
  });

  const branch = await prisma.branch.create({
    data: { organizationId: organization.id, name: 'Head Office', code: 'HQ' },
  });

  const department = await prisma.department.create({
    data: { organizationId: organization.id, branchId: branch.id, name: 'Operations', code: 'OPS' },
  });

  const roleMap: Record<string, string> = {};
  for (const [roleName, permissionKeys] of Object.entries(ROLE_PERMISSION_MAP)) {
    const role = await prisma.role.create({ data: { organizationId: organization.id, name: roleName, isSystem: true } });
    roleMap[roleName] = role.id;
    for (const key of permissionKeys) {
      const permission = await prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, module: key.split(':')[0] },
      });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    }
  }

  const passwordHash = await bcrypt.hash('Admin@12345', 12);
  const admin = await prisma.user.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      departmentId: department.id,
      email: 'admin@docentra-demo.com',
      passwordHash,
      firstName: 'Ada',
      lastName: 'Admin',
      emailVerifiedAt: new Date(),
    },
  });
  await prisma.userRole.create({ data: { userId: admin.id, roleId: roleMap[SYSTEM_ROLES.SUPER_ADMIN] } });

  const rootFolder = await prisma.folder.create({
    data: { organizationId: organization.id, name: 'General', path: '/', createdById: admin.id },
  });
  await prisma.folder.update({ where: { id: rootFolder.id }, data: { path: `/${rootFolder.id}` } });

  console.log('Seed complete.');
  console.log(`Organization slug: ${organization.slug}`);
  console.log('Admin login: admin@docentra-demo.com / Admin@12345');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

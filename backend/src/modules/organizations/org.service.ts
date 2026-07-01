import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';

export async function getOrganization(organizationId: string) {
  return prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
}

export async function updateOrganization(organizationId: string, data: { name?: string; logoUrl?: string; theme?: unknown }) {
  return prisma.organization.update({ where: { id: organizationId }, data: data as never });
}

export async function listBranches(organizationId: string) {
  return prisma.branch.findMany({ where: { organizationId }, orderBy: { name: 'asc' } });
}

export async function createBranch(organizationId: string, data: { name: string; code: string; address?: string }) {
  const existing = await prisma.branch.findUnique({ where: { organizationId_code: { organizationId, code: data.code } } });
  if (existing) throw ApiError.conflict('Branch code already exists');
  return prisma.branch.create({ data: { ...data, organizationId } });
}

export async function updateBranch(organizationId: string, branchId: string, data: { name?: string; address?: string }) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, organizationId } });
  if (!branch) throw ApiError.notFound('Branch not found');
  return prisma.branch.update({ where: { id: branchId }, data });
}

export async function deleteBranch(organizationId: string, branchId: string) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, organizationId } });
  if (!branch) throw ApiError.notFound('Branch not found');
  await prisma.branch.delete({ where: { id: branchId } });
}

export async function listDepartments(organizationId: string) {
  return prisma.department.findMany({ where: { organizationId }, orderBy: { name: 'asc' }, include: { branch: true, parent: true } });
}

export async function createDepartment(organizationId: string, data: { name: string; code: string; branchId?: string; parentId?: string }) {
  const existing = await prisma.department.findUnique({ where: { organizationId_code: { organizationId, code: data.code } } });
  if (existing) throw ApiError.conflict('Department code already exists');
  return prisma.department.create({ data: { ...data, organizationId } });
}

export async function updateDepartment(
  organizationId: string,
  departmentId: string,
  data: { name?: string; branchId?: string; parentId?: string },
) {
  const dept = await prisma.department.findFirst({ where: { id: departmentId, organizationId } });
  if (!dept) throw ApiError.notFound('Department not found');
  return prisma.department.update({ where: { id: departmentId }, data });
}

export async function deleteDepartment(organizationId: string, departmentId: string) {
  const dept = await prisma.department.findFirst({ where: { id: departmentId, organizationId } });
  if (!dept) throw ApiError.notFound('Department not found');
  await prisma.department.delete({ where: { id: departmentId } });
}

export async function listRoles(organizationId: string) {
  return prisma.role.findMany({
    where: { organizationId },
    include: { permissions: { include: { permission: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function createRole(organizationId: string, data: { name: string; description?: string; permissionKeys: string[] }) {
  const existing = await prisma.role.findUnique({ where: { organizationId_name: { organizationId, name: data.name } } });
  if (existing) throw ApiError.conflict('Role name already exists');

  return prisma.$transaction(async (tx) => {
    const role = await tx.role.create({ data: { organizationId, name: data.name, description: data.description } });
    for (const key of data.permissionKeys) {
      const permission = await tx.permission.findUnique({ where: { key } });
      if (!permission) continue;
      await tx.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    }
    return tx.role.findUniqueOrThrow({ where: { id: role.id }, include: { permissions: { include: { permission: true } } } });
  });
}

export async function updateRolePermissions(organizationId: string, roleId: string, permissionKeys: string[]) {
  const role = await prisma.role.findFirst({ where: { id: roleId, organizationId } });
  if (!role) throw ApiError.notFound('Role not found');
  if (role.isSystem) throw ApiError.forbidden('System roles cannot be modified');

  return prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    for (const key of permissionKeys) {
      const permission = await tx.permission.findUnique({ where: { key } });
      if (!permission) continue;
      await tx.rolePermission.create({ data: { roleId, permissionId: permission.id } });
    }
    return tx.role.findUniqueOrThrow({ where: { id: roleId }, include: { permissions: { include: { permission: true } } } });
  });
}

export async function deleteRole(organizationId: string, roleId: string) {
  const role = await prisma.role.findFirst({ where: { id: roleId, organizationId } });
  if (!role) throw ApiError.notFound('Role not found');
  if (role.isSystem) throw ApiError.forbidden('System roles cannot be deleted');
  await prisma.role.delete({ where: { id: roleId } });
}

export async function listAllPermissions() {
  return prisma.permission.findMany({ orderBy: { key: 'asc' } });
}

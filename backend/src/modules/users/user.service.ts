import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { validatePasswordPolicy } from '../auth/auth.service';

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  phone: true,
  isActive: true,
  mfaEnabled: true,
  departmentId: true,
  branchId: true,
  lastLoginAt: true,
  createdAt: true,
  roles: { include: { role: true } },
};

export async function listUsers(
  organizationId: string,
  filters: { departmentId?: string; branchId?: string; search?: string; page?: number; pageSize?: number },
) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;

  const where = {
    organizationId,
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    ...(filters.search
      ? {
          OR: [
            { email: { contains: filters.search, mode: 'insensitive' as const } },
            { firstName: { contains: filters.search, mode: 'insensitive' as const } },
            { lastName: { contains: filters.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, select: userSelect, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, pageSize };
}

export async function getUser(organizationId: string, userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, organizationId }, select: userSelect });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

export async function createUser(
  organizationId: string,
  data: { email: string; firstName: string; lastName: string; password: string; departmentId?: string; branchId?: string; roleIds?: string[] },
) {
  validatePasswordPolicy(data.password);
  const existing = await prisma.user.findUnique({ where: { organizationId_email: { organizationId, email: data.email.toLowerCase() } } });
  if (existing) throw ApiError.conflict('A user with this email already exists');

  const passwordHash = await bcrypt.hash(data.password, env.bcryptRounds);
  const user = await prisma.user.create({
    data: {
      organizationId,
      email: data.email.toLowerCase(),
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash,
      departmentId: data.departmentId,
      branchId: data.branchId,
      emailVerifiedAt: new Date(),
      roles: data.roleIds ? { create: data.roleIds.map((roleId) => ({ roleId })) } : undefined,
    },
    select: userSelect,
  });
  return user;
}

export async function updateUser(
  organizationId: string,
  userId: string,
  data: { firstName?: string; lastName?: string; phone?: string; departmentId?: string; branchId?: string; isActive?: boolean },
) {
  const user = await prisma.user.findFirst({ where: { id: userId, organizationId } });
  if (!user) throw ApiError.notFound('User not found');
  return prisma.user.update({ where: { id: userId }, data, select: userSelect });
}

export async function deactivateUser(organizationId: string, userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, organizationId } });
  if (!user) throw ApiError.notFound('User not found');
  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
  await prisma.session.updateMany({ where: { userId }, data: { isActive: false } });
}

export async function assignRoles(organizationId: string, userId: string, roleIds: string[]) {
  const user = await prisma.user.findFirst({ where: { id: userId, organizationId } });
  if (!user) throw ApiError.notFound('User not found');

  await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId } });
    for (const roleId of roleIds) {
      await tx.userRole.create({ data: { userId, roleId } });
    }
  });

  return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect });
}

export async function getUserActivity(organizationId: string, userId: string, limit = 50) {
  return prisma.auditLog.findMany({
    where: { organizationId, userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function grantTemporaryAccess(
  userId: string,
  data: { resourceType: 'document' | 'folder'; resourceId: string; permission: string; expiresAt: string },
) {
  return prisma.temporaryAccess.create({
    data: {
      userId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      permission: data.permission,
      expiresAt: new Date(data.expiresAt),
    },
  });
}

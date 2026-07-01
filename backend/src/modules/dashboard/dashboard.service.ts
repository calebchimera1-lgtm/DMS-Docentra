import { prisma } from '../../config/prisma';

export async function getUserDashboard(organizationId: string, userId: string) {
  const [recentDocuments, favoriteDocuments, pendingApprovals, pendingSignatures, recentActivities, unreadNotifications, organization] =
    await Promise.all([
      prisma.document.findMany({ where: { organizationId, deletedAt: null }, orderBy: { updatedAt: 'desc' }, take: 8 }),
      prisma.document.findMany({ where: { organizationId, deletedAt: null, favorites: { some: { userId } } }, take: 8 }),
      prisma.workflowStepInstance.count({ where: { approverId: userId, status: 'PENDING', workflowInstance: { template: { organizationId } } } }),
      prisma.signature.count({ where: { signerId: userId, status: 'PENDING', signatureRequest: { document: { organizationId } } } }),
      prisma.auditLog.findMany({ where: { organizationId, userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    ]);

  return {
    recentDocuments,
    favoriteDocuments,
    pendingApprovalsCount: pendingApprovals,
    pendingSignaturesCount: pendingSignatures,
    recentActivities,
    unreadNotifications,
    storage: {
      usedBytes: organization.storageUsedBytes.toString(),
      quotaBytes: organization.storageQuotaBytes.toString(),
      percentUsed: Number(organization.storageUsedBytes) / Number(organization.storageQuotaBytes),
    },
  };
}

export async function getExecutiveDashboard(organizationId: string) {
  const [totalDocuments, totalUsers, totalFolders, workflowCounts, documentsByType, departmentUserCounts, organization, recentAuditCount] =
    await Promise.all([
      prisma.document.count({ where: { organizationId, deletedAt: null } }),
      prisma.user.count({ where: { organizationId, isActive: true } }),
      prisma.folder.count({ where: { organizationId, deletedAt: null } }),
      prisma.workflowInstance.groupBy({ by: ['status'], where: { template: { organizationId } }, _count: true }),
      prisma.document.groupBy({ by: ['fileType'], where: { organizationId, deletedAt: null }, _count: true }),
      prisma.department.findMany({ where: { organizationId }, include: { _count: { select: { users: true } } } }),
      prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
      prisma.auditLog.count({ where: { organizationId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    ]);

  return {
    totalDocuments,
    totalUsers,
    totalFolders,
    workflowStatusBreakdown: workflowCounts.map((w) => ({ status: w.status, count: w._count })),
    documentsByFileType: documentsByType.map((d) => ({ fileType: d.fileType, count: d._count })),
    departmentStats: departmentUserCounts.map((d) => ({ department: d.name, userCount: d._count.users })),
    storage: {
      usedBytes: organization.storageUsedBytes.toString(),
      quotaBytes: organization.storageQuotaBytes.toString(),
      percentUsed: Number(organization.storageUsedBytes) / Number(organization.storageQuotaBytes),
    },
    activityLast30Days: recentAuditCount,
  };
}

export async function getComplianceReport(organizationId: string) {
  const [legalHolds, retentionPolicies, confidentialityBreakdown] = await Promise.all([
    prisma.retentionPolicy.count({ where: { organizationId, legalHold: true } }),
    prisma.retentionPolicy.findMany({ where: { organizationId } }),
    prisma.document.groupBy({ by: ['confidentiality'], where: { organizationId, deletedAt: null }, _count: true }),
  ]);

  return {
    legalHoldsActive: legalHolds,
    retentionPolicies,
    confidentialityBreakdown: confidentialityBreakdown.map((c) => ({ confidentiality: c.confidentiality, count: c._count })),
  };
}

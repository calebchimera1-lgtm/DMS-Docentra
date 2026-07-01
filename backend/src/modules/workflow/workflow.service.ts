import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { createNotification } from '../notifications/notification.service';

export async function listTemplates(organizationId: string) {
  return prisma.workflowTemplate.findMany({
    where: { organizationId },
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
    orderBy: { name: 'asc' },
  });
}

export async function createTemplate(
  organizationId: string,
  data: {
    name: string;
    description?: string;
    slaHours?: number;
    steps: { name: string; stepOrder: number; approverRoleId?: string; approverUserId?: string; isParallel?: boolean; slaHours?: number }[];
  },
) {
  return prisma.workflowTemplate.create({
    data: {
      organizationId,
      name: data.name,
      description: data.description,
      slaHours: data.slaHours,
      steps: { create: data.steps },
    },
    include: { steps: true },
  });
}

export async function updateTemplate(organizationId: string, templateId: string, data: { name?: string; description?: string; isActive?: boolean }) {
  const template = await prisma.workflowTemplate.findFirst({ where: { id: templateId, organizationId } });
  if (!template) throw ApiError.notFound('Workflow template not found');
  return prisma.workflowTemplate.update({ where: { id: templateId }, data });
}

async function resolveApproversForStep(organizationId: string, step: { approverUserId: string | null; approverRoleId: string | null }) {
  if (step.approverUserId) return [step.approverUserId];
  if (step.approverRoleId) {
    const userRoles = await prisma.userRole.findMany({ where: { roleId: step.approverRoleId }, include: { user: true } });
    return userRoles.filter((ur) => ur.user.organizationId === organizationId && ur.user.isActive).map((ur) => ur.userId);
  }
  return [];
}

async function activateStep(instanceId: string, stepOrder: number) {
  const instance = await prisma.workflowInstance.findUniqueOrThrow({ where: { id: instanceId }, include: { template: { include: { steps: true } } } });
  const stepsAtOrder = instance.template.steps.filter((s) => s.stepOrder === stepOrder);

  for (const step of stepsAtOrder) {
    const approverIds = await resolveApproversForStep(instance.template.organizationId, step);
    for (const approverId of approverIds) {
      const dueAt = step.slaHours ? new Date(Date.now() + step.slaHours * 60 * 60 * 1000) : null;
      await prisma.workflowStepInstance.create({
        data: { workflowInstanceId: instanceId, workflowStepId: step.id, approverId, dueAt },
      });
      await createNotification(
        instance.template.organizationId,
        approverId,
        'workflow',
        'Approval requested',
        `You have a pending approval for a document workflow: ${instance.template.name}`,
        { workflowInstanceId: instanceId },
        { email: true },
      );
    }
  }
}

export async function initiateWorkflow(organizationId: string, documentId: string, templateId: string, initiatedById: string) {
  const template = await prisma.workflowTemplate.findFirst({ where: { id: templateId, organizationId }, include: { steps: true } });
  if (!template) throw ApiError.notFound('Workflow template not found');
  if (!template.steps.length) throw ApiError.badRequest('Workflow template has no steps configured');

  const document = await prisma.document.findFirst({ where: { id: documentId, organizationId } });
  if (!document) throw ApiError.notFound('Document not found');

  const firstStepOrder = Math.min(...template.steps.map((s) => s.stepOrder));
  const instance = await prisma.workflowInstance.create({
    data: { templateId, documentId, initiatedById, currentStep: firstStepOrder, status: 'IN_PROGRESS' },
  });

  await activateStep(instance.id, firstStepOrder);
  return prisma.workflowInstance.findUniqueOrThrow({ where: { id: instance.id }, include: { steps: true, template: { include: { steps: true } } } });
}

export async function actOnStep(
  organizationId: string,
  workflowInstanceId: string,
  stepInstanceId: string,
  approverId: string,
  action: 'APPROVE' | 'REJECT',
  comment?: string,
) {
  const stepInstance = await prisma.workflowStepInstance.findFirst({
    where: { id: stepInstanceId, workflowInstanceId },
    include: { workflowInstance: { include: { template: { include: { steps: true } } } }, step: true },
  });
  if (!stepInstance) throw ApiError.notFound('Approval task not found');
  if (stepInstance.workflowInstance.template.organizationId !== organizationId) throw ApiError.forbidden();
  if (stepInstance.approverId !== approverId) throw ApiError.forbidden('You are not the assigned approver for this task');
  if (stepInstance.status !== 'PENDING') throw ApiError.conflict('This approval task has already been actioned');

  const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  await prisma.workflowStepInstance.update({ where: { id: stepInstanceId }, data: { status: newStatus, comment, actedAt: new Date() } });

  const instance = stepInstance.workflowInstance;

  if (action === 'REJECT') {
    await prisma.workflowStepInstance.updateMany({
      where: { workflowInstanceId, status: 'PENDING' },
      data: { status: 'SKIPPED' },
    });
    await prisma.workflowInstance.update({ where: { id: workflowInstanceId }, data: { status: 'REJECTED', completedAt: new Date() } });
    await notifyInitiator(instance.templateId, instance.initiatedById, instance.documentId, 'rejected');
    return prisma.workflowInstance.findUniqueOrThrow({ where: { id: workflowInstanceId }, include: { steps: true } });
  }

  // Skip remaining sibling approvers at this step order once one approver in the step approves (any-of routing).
  const siblingPending = await prisma.workflowStepInstance.findMany({
    where: { workflowInstanceId, workflowStepId: stepInstance.workflowStepId, status: 'PENDING' },
  });
  if (siblingPending.length) {
    await prisma.workflowStepInstance.updateMany({
      where: { id: { in: siblingPending.map((s) => s.id) } },
      data: { status: 'SKIPPED' },
    });
  }

  // Determine if all steps at the current stepOrder are resolved (approved/skipped) to advance.
  const currentOrderSteps = instance.template.steps.filter((s) => s.stepOrder === stepInstance.step.stepOrder);
  const allInstancesAtOrder = await prisma.workflowStepInstance.findMany({
    where: { workflowInstanceId, workflowStepId: { in: currentOrderSteps.map((s) => s.id) } },
  });
  const orderResolved = allInstancesAtOrder.every((s) => s.status === 'APPROVED' || s.status === 'SKIPPED');

  if (orderResolved) {
    const remainingOrders = instance.template.steps.map((s) => s.stepOrder).filter((o) => o > stepInstance.step.stepOrder);
    if (remainingOrders.length === 0) {
      await prisma.workflowInstance.update({ where: { id: workflowInstanceId }, data: { status: 'APPROVED', completedAt: new Date() } });
      await notifyInitiator(instance.templateId, instance.initiatedById, instance.documentId, 'approved');
    } else {
      const nextOrder = Math.min(...remainingOrders);
      await prisma.workflowInstance.update({ where: { id: workflowInstanceId }, data: { currentStep: nextOrder } });
      await activateStep(workflowInstanceId, nextOrder);
    }
  }

  return prisma.workflowInstance.findUniqueOrThrow({ where: { id: workflowInstanceId }, include: { steps: true } });
}

async function notifyInitiator(templateId: string, initiatedById: string, documentId: string, outcome: 'approved' | 'rejected') {
  const template = await prisma.workflowTemplate.findUniqueOrThrow({ where: { id: templateId } });
  await createNotification(
    template.organizationId,
    initiatedById,
    'workflow',
    `Workflow ${outcome}`,
    `Your workflow "${template.name}" for a document has been ${outcome}.`,
    { documentId },
    { email: true },
  );
}

export async function delegateStep(organizationId: string, stepInstanceId: string, fromUserId: string, toUserId: string) {
  const stepInstance = await prisma.workflowStepInstance.findFirst({
    where: { id: stepInstanceId },
    include: { workflowInstance: { include: { template: true } } },
  });
  if (!stepInstance || stepInstance.workflowInstance.template.organizationId !== organizationId) throw ApiError.notFound('Approval task not found');
  if (stepInstance.approverId !== fromUserId) throw ApiError.forbidden('Only the assigned approver can delegate this task');
  if (stepInstance.status !== 'PENDING') throw ApiError.conflict('This task has already been actioned');

  await prisma.workflowStepInstance.update({ where: { id: stepInstanceId }, data: { status: 'DELEGATED', actedAt: new Date() } });
  const delegated = await prisma.workflowStepInstance.create({
    data: { workflowInstanceId: stepInstance.workflowInstanceId, workflowStepId: stepInstance.workflowStepId, approverId: toUserId, dueAt: stepInstance.dueAt },
  });

  await createNotification(organizationId, toUserId, 'workflow', 'Approval delegated to you', 'A workflow approval task has been delegated to you.', { stepInstanceId: delegated.id });
  return delegated;
}

export async function listMyPendingApprovals(organizationId: string, approverId: string) {
  return prisma.workflowStepInstance.findMany({
    where: {
      approverId,
      status: 'PENDING',
      workflowInstance: { template: { organizationId } },
    },
    include: {
      workflowInstance: { include: { document: true, template: true } },
      step: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getWorkflowInstance(organizationId: string, instanceId: string) {
  const instance = await prisma.workflowInstance.findFirst({
    where: { id: instanceId, template: { organizationId } },
    include: { steps: { include: { approver: { select: { id: true, firstName: true, lastName: true } }, step: true } }, template: true, document: true },
  });
  if (!instance) throw ApiError.notFound('Workflow instance not found');
  return instance;
}

export async function listWorkflowInstancesForDocument(organizationId: string, documentId: string) {
  return prisma.workflowInstance.findMany({
    where: { documentId, template: { organizationId } },
    include: { steps: true, template: true },
    orderBy: { createdAt: 'desc' },
  });
}

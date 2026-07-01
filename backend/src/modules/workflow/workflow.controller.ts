import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { recordAudit } from '../../utils/audit';
import * as service from './workflow.service';

export const listTemplates = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.listTemplates(req.user!.organizationId) });
});

export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await service.createTemplate(req.user!.organizationId, req.body);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'workflow.template.create', resourceType: 'workflow_template', resourceId: template.id });
  res.status(201).json({ success: true, data: template });
});

export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await service.updateTemplate(req.user!.organizationId, req.params.templateId, req.body);
  res.json({ success: true, data: template });
});

export const initiateWorkflow = asyncHandler(async (req: Request, res: Response) => {
  const instance = await service.initiateWorkflow(req.user!.organizationId, req.body.documentId, req.body.templateId, req.user!.sub);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'workflow.initiate', resourceType: 'workflow_instance', resourceId: instance.id });
  res.status(201).json({ success: true, data: instance });
});

export const actOnStep = asyncHandler(async (req: Request, res: Response) => {
  const { action, comment } = req.body;
  const instance = await service.actOnStep(req.user!.organizationId, req.params.instanceId, req.params.stepInstanceId, req.user!.sub, action, comment);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: `workflow.step.${action.toLowerCase()}`, resourceType: 'workflow_instance', resourceId: instance.id });
  res.json({ success: true, data: instance });
});

export const delegateStep = asyncHandler(async (req: Request, res: Response) => {
  const delegated = await service.delegateStep(req.user!.organizationId, req.params.stepInstanceId, req.user!.sub, req.body.toUserId);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'workflow.step.delegate', resourceType: 'workflow_step_instance', resourceId: delegated.id });
  res.json({ success: true, data: delegated });
});

export const listMyPendingApprovals = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.listMyPendingApprovals(req.user!.organizationId, req.user!.sub) });
});

export const getWorkflowInstance = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.getWorkflowInstance(req.user!.organizationId, req.params.instanceId) });
});

export const listWorkflowInstancesForDocument = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.listWorkflowInstancesForDocument(req.user!.organizationId, req.params.documentId) });
});

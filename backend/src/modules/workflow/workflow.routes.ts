import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requirePermission } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { PERMISSIONS } from '../../config/permissions';
import * as controller from './workflow.controller';

export const workflowRouter = Router();
workflowRouter.use(authenticate);

workflowRouter.get('/templates', controller.listTemplates);
workflowRouter.post('/templates', requirePermission(PERMISSIONS.WORKFLOW_MANAGE), [body('name').notEmpty(), body('steps').isArray({ min: 1 })], validate, controller.createTemplate);
workflowRouter.patch('/templates/:templateId', requirePermission(PERMISSIONS.WORKFLOW_MANAGE), controller.updateTemplate);

workflowRouter.post('/instances', requirePermission(PERMISSIONS.WORKFLOW_INITIATE), [body('documentId').isString(), body('templateId').isString()], validate, controller.initiateWorkflow);
workflowRouter.get('/instances/:instanceId', controller.getWorkflowInstance);
workflowRouter.get('/documents/:documentId/instances', controller.listWorkflowInstancesForDocument);

workflowRouter.get('/my-approvals', controller.listMyPendingApprovals);
workflowRouter.post(
  '/instances/:instanceId/steps/:stepInstanceId/action',
  requirePermission(PERMISSIONS.WORKFLOW_APPROVE),
  [body('action').isIn(['APPROVE', 'REJECT'])],
  validate,
  controller.actOnStep,
);
workflowRouter.post('/steps/:stepInstanceId/delegate', requirePermission(PERMISSIONS.WORKFLOW_APPROVE), [body('toUserId').isString()], validate, controller.delegateStep);

import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth';
import { PERMISSIONS } from '../../config/permissions';
import * as controller from './audit.controller';

export const auditRouter = Router();
auditRouter.use(authenticate, requirePermission(PERMISSIONS.AUDIT_VIEW));

auditRouter.get('/', controller.listAuditLogs);
auditRouter.get('/export', controller.exportAuditLogs);

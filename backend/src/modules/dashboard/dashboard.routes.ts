import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth';
import { PERMISSIONS } from '../../config/permissions';
import * as controller from './dashboard.controller';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get('/me', controller.getUserDashboard);
dashboardRouter.get('/executive', requirePermission(PERMISSIONS.REPORTS_VIEW), controller.getExecutiveDashboard);
dashboardRouter.get('/compliance', requirePermission(PERMISSIONS.REPORTS_VIEW), controller.getComplianceReport);

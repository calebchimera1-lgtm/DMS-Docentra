import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { userRouter } from '../modules/users/user.routes';
import { orgRouter } from '../modules/organizations/org.routes';
import { folderRouter } from '../modules/documents/folder.routes';
import { documentRouter } from '../modules/documents/document.routes';
import { searchRouter } from '../modules/search/search.routes';
import { workflowRouter } from '../modules/workflow/workflow.routes';
import { signatureRouter } from '../modules/signatures/signature.routes';
import { notificationRouter } from '../modules/notifications/notification.routes';
import { auditRouter } from '../modules/audit/audit.routes';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes';

export const router = Router();

router.use('/auth', authRouter);
router.use('/users', userRouter);
router.use('/organizations', orgRouter);
router.use('/folders', folderRouter);
router.use('/documents', documentRouter);
router.use('/search', searchRouter);
router.use('/workflows', workflowRouter);
router.use('/signatures', signatureRouter);
router.use('/notifications', notificationRouter);
router.use('/audit-logs', auditRouter);
router.use('/dashboard', dashboardRouter);

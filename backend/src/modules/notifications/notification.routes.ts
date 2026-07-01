import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import * as controller from './notification.controller';

export const notificationRouter = Router();
notificationRouter.use(authenticate);

notificationRouter.get('/', controller.listNotifications);
notificationRouter.post('/:notificationId/read', controller.markAsRead);
notificationRouter.post('/read-all', controller.markAllAsRead);

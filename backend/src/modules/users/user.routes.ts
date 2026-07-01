import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requirePermission } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { PERMISSIONS } from '../../config/permissions';
import * as controller from './user.controller';

export const userRouter = Router();
userRouter.use(authenticate);

userRouter.get('/', requirePermission(PERMISSIONS.ADMIN_USERS), controller.listUsers);
userRouter.post(
  '/',
  requirePermission(PERMISSIONS.ADMIN_USERS),
  [body('email').isEmail(), body('firstName').notEmpty(), body('lastName').notEmpty(), body('password').isString().isLength({ min: 10 })],
  validate,
  controller.createUser,
);
userRouter.get('/:userId', requirePermission(PERMISSIONS.ADMIN_USERS), controller.getUser);
userRouter.patch('/:userId', requirePermission(PERMISSIONS.ADMIN_USERS), controller.updateUser);
userRouter.delete('/:userId', requirePermission(PERMISSIONS.ADMIN_USERS), controller.deactivateUser);
userRouter.put('/:userId/roles', requirePermission(PERMISSIONS.ADMIN_USERS), [body('roleIds').isArray()], validate, controller.assignRoles);
userRouter.get('/:userId/activity', requirePermission(PERMISSIONS.ADMIN_USERS), controller.getUserActivity);
userRouter.post(
  '/:userId/temporary-access',
  requirePermission(PERMISSIONS.ADMIN_USERS),
  [body('resourceType').isIn(['document', 'folder']), body('resourceId').isString(), body('permission').isString(), body('expiresAt').isISO8601()],
  validate,
  controller.grantTemporaryAccess,
);

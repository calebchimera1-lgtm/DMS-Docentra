import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requirePermission } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { PERMISSIONS } from '../../config/permissions';
import * as controller from './org.controller';

export const orgRouter = Router();
orgRouter.use(authenticate);

orgRouter.get('/me', controller.getMyOrganization);
orgRouter.patch('/me', requirePermission(PERMISSIONS.ADMIN_ORG_SETTINGS), controller.updateMyOrganization);

orgRouter.get('/branches', controller.listBranches);
orgRouter.post('/branches', requirePermission(PERMISSIONS.ADMIN_DEPARTMENTS), [body('name').notEmpty(), body('code').notEmpty()], validate, controller.createBranch);
orgRouter.patch('/branches/:branchId', requirePermission(PERMISSIONS.ADMIN_DEPARTMENTS), controller.updateBranch);
orgRouter.delete('/branches/:branchId', requirePermission(PERMISSIONS.ADMIN_DEPARTMENTS), controller.deleteBranch);

orgRouter.get('/departments', controller.listDepartments);
orgRouter.post('/departments', requirePermission(PERMISSIONS.ADMIN_DEPARTMENTS), [body('name').notEmpty(), body('code').notEmpty()], validate, controller.createDepartment);
orgRouter.patch('/departments/:departmentId', requirePermission(PERMISSIONS.ADMIN_DEPARTMENTS), controller.updateDepartment);
orgRouter.delete('/departments/:departmentId', requirePermission(PERMISSIONS.ADMIN_DEPARTMENTS), controller.deleteDepartment);

orgRouter.get('/roles', controller.listRoles);
orgRouter.post('/roles', requirePermission(PERMISSIONS.ADMIN_ROLES), [body('name').notEmpty()], validate, controller.createRole);
orgRouter.patch('/roles/:roleId/permissions', requirePermission(PERMISSIONS.ADMIN_ROLES), [body('permissionKeys').isArray()], validate, controller.updateRolePermissions);
orgRouter.delete('/roles/:roleId', requirePermission(PERMISSIONS.ADMIN_ROLES), controller.deleteRole);

orgRouter.get('/permissions', controller.listPermissions);

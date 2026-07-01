import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requirePermission } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { PERMISSIONS } from '../../config/permissions';
import * as controller from './folder.controller';

export const folderRouter = Router();
folderRouter.use(authenticate);

folderRouter.get('/', controller.listFolders);
folderRouter.get('/:folderId/breadcrumb', controller.getBreadcrumb);
folderRouter.post('/', requirePermission(PERMISSIONS.FOLDER_CREATE), [body('name').notEmpty()], validate, controller.createFolder);
folderRouter.patch('/:folderId/rename', requirePermission(PERMISSIONS.FOLDER_CREATE), [body('name').notEmpty()], validate, controller.renameFolder);
folderRouter.patch('/:folderId/move', requirePermission(PERMISSIONS.FOLDER_CREATE), controller.moveFolder);
folderRouter.patch('/:folderId/archive', requirePermission(PERMISSIONS.FOLDER_CREATE), controller.archiveFolder);
folderRouter.delete('/:folderId', requirePermission(PERMISSIONS.FOLDER_DELETE), controller.deleteFolder);

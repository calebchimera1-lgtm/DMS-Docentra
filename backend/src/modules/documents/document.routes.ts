import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requirePermission } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { PERMISSIONS } from '../../config/permissions';
import { upload } from './upload.middleware';
import * as controller from './document.controller';

export const documentRouter = Router();

// Public share-link route must be registered before the authenticate() gate.
documentRouter.get('/shared/:token', controller.accessSharedDocument);

documentRouter.use(authenticate);

documentRouter.get('/', controller.listDocuments);
documentRouter.get('/favorites', controller.listFavorites);
documentRouter.get('/recycle-bin', controller.listRecycleBin);
documentRouter.get('/tags', controller.listOrgTags);

documentRouter.post('/upload', requirePermission(PERMISSIONS.DOCUMENT_CREATE), upload.single('file'), controller.uploadDocument);
documentRouter.post('/bulk-upload', requirePermission(PERMISSIONS.DOCUMENT_CREATE), upload.array('files', 50), controller.bulkUpload);

documentRouter.get('/:documentId', controller.getDocument);
documentRouter.get('/:documentId/download', requirePermission(PERMISSIONS.DOCUMENT_DOWNLOAD), controller.downloadDocument);
documentRouter.patch('/:documentId', requirePermission(PERMISSIONS.DOCUMENT_UPDATE), controller.updateDocument);
documentRouter.patch('/:documentId/move', requirePermission(PERMISSIONS.DOCUMENT_UPDATE), controller.moveDocument);
documentRouter.post('/:documentId/copy', requirePermission(PERMISSIONS.DOCUMENT_CREATE), controller.copyDocument);
documentRouter.delete('/:documentId', requirePermission(PERMISSIONS.DOCUMENT_DELETE), controller.deleteDocument);
documentRouter.post('/:documentId/restore', requirePermission(PERMISSIONS.DOCUMENT_RESTORE), controller.restoreDocument);
documentRouter.delete('/:documentId/permanent', requirePermission(PERMISSIONS.DOCUMENT_DELETE), controller.permanentlyDeleteDocument);

documentRouter.post('/:documentId/check-out', requirePermission(PERMISSIONS.DOCUMENT_UPDATE), controller.checkOutDocument);
documentRouter.post('/:documentId/check-in', requirePermission(PERMISSIONS.DOCUMENT_UPDATE), controller.checkInDocument);

documentRouter.post('/:documentId/versions', requirePermission(PERMISSIONS.DOCUMENT_UPDATE), upload.single('file'), controller.uploadNewVersion);
documentRouter.get('/:documentId/versions', controller.listVersions);
documentRouter.post('/:documentId/versions/:versionNumber/restore', requirePermission(PERMISSIONS.DOCUMENT_UPDATE), controller.restoreVersion);
documentRouter.get('/:documentId/versions/compare', controller.compareVersions);

documentRouter.post('/:documentId/favorite', controller.toggleFavorite);

documentRouter.post('/:documentId/comments', [body('body').notEmpty()], validate, controller.addComment);

documentRouter.post('/:documentId/tags', [body('tags').isArray()], validate, controller.addTags);
documentRouter.delete('/:documentId/tags/:tagId', controller.removeTag);

documentRouter.post('/:documentId/metadata', [body('fieldName').notEmpty(), body('fieldValue').notEmpty()], validate, controller.addMetadataField);

documentRouter.post('/:documentId/share-links', requirePermission(PERMISSIONS.DOCUMENT_SHARE), controller.createShareLink);
documentRouter.get('/:documentId/share-links', requirePermission(PERMISSIONS.DOCUMENT_SHARE), controller.listShareLinks);
documentRouter.delete('/:documentId/share-links/:linkId', requirePermission(PERMISSIONS.DOCUMENT_SHARE), controller.revokeShareLink);

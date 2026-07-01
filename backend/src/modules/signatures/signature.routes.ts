import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requirePermission } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { PERMISSIONS } from '../../config/permissions';
import * as controller from './signature.controller';

export const signatureRouter = Router();
signatureRouter.use(authenticate);

signatureRouter.post(
  '/requests',
  requirePermission(PERMISSIONS.SIGNATURE_REQUEST),
  [body('documentId').isString(), body('signatoryUserIds').isArray({ min: 1 })],
  validate,
  controller.createSignatureRequest,
);
signatureRouter.get('/requests/:requestId', controller.getSignatureRequest);
signatureRouter.get('/my-pending', controller.listMyPendingSignatures);
signatureRouter.post('/:signatureId/sign', requirePermission(PERMISSIONS.SIGNATURE_SIGN), controller.signDocument);
signatureRouter.post('/:signatureId/decline', requirePermission(PERMISSIONS.SIGNATURE_SIGN), controller.declineSignature);
signatureRouter.get('/:signatureId/verify', controller.verifySignature);

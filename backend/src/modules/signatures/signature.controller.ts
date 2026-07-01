import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { recordAudit } from '../../utils/audit';
import * as service from './signature.service';

export const createSignatureRequest = asyncHandler(async (req: Request, res: Response) => {
  const request = await service.createSignatureRequest(req.user!.organizationId, req.user!.sub, req.body.documentId, req.body.signatoryUserIds);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'signature.request.create', resourceType: 'signature_request', resourceId: request.id });
  res.status(201).json({ success: true, data: request });
});

export const getSignatureRequest = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.getSignatureRequest(req.user!.organizationId, req.params.requestId) });
});

export const listMyPendingSignatures = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.listPendingSignaturesForUser(req.user!.organizationId, req.user!.sub) });
});

export const signDocument = asyncHandler(async (req: Request, res: Response) => {
  const signature = await service.signDocument(req.user!.organizationId, req.params.signatureId, req.user!.sub, {
    signatureImage: req.body.signatureImage,
    typedName: req.body.typedName,
    ipAddress: req.ip,
  });
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'signature.sign', resourceType: 'signature', resourceId: signature.id });
  res.json({ success: true, data: signature });
});

export const declineSignature = asyncHandler(async (req: Request, res: Response) => {
  const signature = await service.declineSignature(req.user!.organizationId, req.params.signatureId, req.user!.sub, req.body.reason);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'signature.decline', resourceType: 'signature', resourceId: signature.id });
  res.json({ success: true, data: signature });
});

export const verifySignature = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.verifySignature(req.params.signatureId) });
});

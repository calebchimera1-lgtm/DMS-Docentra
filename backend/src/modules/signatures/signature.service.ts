import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { createNotification } from '../notifications/notification.service';

function computeSignatureHash(documentId: string, signerId: string, content: string, timestamp: string): string {
  return crypto.createHash('sha256').update(`${documentId}:${signerId}:${content}:${timestamp}`).digest('hex');
}

export async function createSignatureRequest(organizationId: string, requestedById: string, documentId: string, signatoryUserIds: string[]) {
  const document = await prisma.document.findFirst({ where: { id: documentId, organizationId } });
  if (!document) throw ApiError.notFound('Document not found');
  if (!signatoryUserIds.length) throw ApiError.badRequest('At least one signatory is required');

  const request = await prisma.signatureRequest.create({
    data: {
      documentId,
      requestedById,
      signatories: { create: signatoryUserIds.map((signerId) => ({ signerId, signatureHash: '' })) },
    },
    include: { signatories: true },
  });

  await Promise.all(
    signatoryUserIds.map((signerId) =>
      createNotification(
        organizationId,
        signerId,
        'signature',
        'Signature requested',
        `You have been requested to sign a document: ${document.name}`,
        { signatureRequestId: request.id },
        { email: true },
      ),
    ),
  );

  return request;
}

export async function getSignatureRequest(organizationId: string, requestId: string) {
  const request = await prisma.signatureRequest.findFirst({
    where: { id: requestId, document: { organizationId } },
    include: { document: true, signatories: { include: { signer: { select: { id: true, firstName: true, lastName: true, email: true } } } } },
  });
  if (!request) throw ApiError.notFound('Signature request not found');
  return request;
}

export async function listPendingSignaturesForUser(organizationId: string, userId: string) {
  return prisma.signature.findMany({
    where: { signerId: userId, status: 'PENDING', signatureRequest: { document: { organizationId } } },
    include: { signatureRequest: { include: { document: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function signDocument(
  organizationId: string,
  signatureId: string,
  signerId: string,
  data: { signatureImage?: string; typedName?: string; ipAddress?: string },
) {
  const signature = await prisma.signature.findFirst({
    where: { id: signatureId, signerId },
    include: { signatureRequest: { include: { document: true } } },
  });
  if (!signature || signature.signatureRequest.document.organizationId !== organizationId) throw ApiError.notFound('Signature task not found');
  if (signature.status !== 'PENDING') throw ApiError.conflict('This signature has already been actioned');

  const timestamp = new Date().toISOString();
  const content = data.signatureImage ?? data.typedName ?? '';
  if (!content) throw ApiError.badRequest('A drawn signature image or typed name is required');

  const hash = computeSignatureHash(signature.signatureRequest.documentId, signerId, content, timestamp);

  const updated = await prisma.signature.update({
    where: { id: signatureId },
    data: {
      status: 'SIGNED',
      signatureImage: data.signatureImage,
      typedName: data.typedName,
      signatureHash: hash,
      ipAddress: data.ipAddress,
      signedAt: new Date(timestamp),
    },
  });

  const remainingPending = await prisma.signature.count({ where: { signatureRequestId: signature.signatureRequestId, status: 'PENDING' } });
  const anyDeclined = await prisma.signature.count({ where: { signatureRequestId: signature.signatureRequestId, status: 'DECLINED' } });

  if (remainingPending === 0) {
    await prisma.signatureRequest.update({
      where: { id: signature.signatureRequestId },
      data: { status: anyDeclined > 0 ? 'DECLINED' : 'COMPLETED', completedAt: new Date() },
    });
  } else {
    await prisma.signatureRequest.update({ where: { id: signature.signatureRequestId }, data: { status: 'PARTIALLY_SIGNED' } });
  }

  return updated;
}

export async function declineSignature(organizationId: string, signatureId: string, signerId: string, reason?: string) {
  const signature = await prisma.signature.findFirst({
    where: { id: signatureId, signerId },
    include: { signatureRequest: { include: { document: true } } },
  });
  if (!signature || signature.signatureRequest.document.organizationId !== organizationId) throw ApiError.notFound('Signature task not found');
  if (signature.status !== 'PENDING') throw ApiError.conflict('This signature has already been actioned');

  const updated = await prisma.signature.update({ where: { id: signatureId }, data: { status: 'DECLINED', signedAt: new Date() } });
  await prisma.signatureRequest.update({ where: { id: signature.signatureRequestId }, data: { status: 'DECLINED' } });

  await createNotification(
    organizationId,
    signature.signatureRequest.requestedById,
    'signature',
    'Signature declined',
    `A signatory declined to sign "${signature.signatureRequest.document.name}"${reason ? `: ${reason}` : ''}`,
  );

  return updated;
}

export async function verifySignature(signatureId: string) {
  const signature = await prisma.signature.findUniqueOrThrow({
    where: { id: signatureId },
    include: { signatureRequest: true },
  });
  if (signature.status !== 'SIGNED' || !signature.signedAt) {
    return { valid: false, reason: 'Signature has not been completed' };
  }
  const content = signature.signatureImage ?? signature.typedName ?? '';
  const recomputed = computeSignatureHash(signature.signatureRequest.documentId, signature.signerId, content, signature.signedAt.toISOString());
  return {
    valid: recomputed === signature.signatureHash,
    signedAt: signature.signedAt,
    storedHash: signature.signatureHash,
    note: 'Hash recorded at signing time; integrity is anchored to the original document + signer + timestamp.',
  };
}

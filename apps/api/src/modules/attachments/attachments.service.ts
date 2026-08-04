import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { StorageService } from "../../common/storage/storage.service";
import { PolymorphicAccessService } from "../../common/polymorphic/polymorphic-access.service";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly access: PolymorphicAccessService,
  ) {}

  async upload(
    companyId: string,
    uploadedById: string,
    entityType: string,
    entityId: string,
    file: UploadedFile,
  ) {
    await this.access.assertAccess(uploadedById, entityType, "write");
    await this.access.assertEntityExists(companyId, entityType, entityId);

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new ForbiddenException(`File exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit`);
    }

    const storageKey = this.storage.buildObjectKey(companyId, file.originalname);
    await this.storage.putObject(storageKey, file.buffer, file.mimetype);

    const attachment = await this.prisma.attachment.create({
      data: {
        companyId,
        uploadedById,
        entityType,
        entityId,
        fileName: storageKey.split("/").pop() ?? storageKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: BigInt(file.size),
        storageProvider: "S3",
        storageKey,
      },
    });

    return this.serialize(attachment);
  }

  async list(companyId: string, userId: string, entityType: string, entityId: string) {
    await this.access.assertAccess(userId, entityType, "read");

    const attachments = await this.prisma.attachment.findMany({
      where: { companyId, entityType, entityId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return attachments.map((a) => this.serialize(a));
  }

  async getDownloadUrl(companyId: string, userId: string, id: string): Promise<{ url: string; fileName: string }> {
    const attachment = await this.findOne(companyId, id);
    await this.access.assertAccess(userId, attachment.entityType, "read");
    const url = await this.storage.getSignedDownloadUrl(attachment.storageKey);
    return { url, fileName: attachment.originalName };
  }

  async remove(companyId: string, userId: string, id: string): Promise<void> {
    const attachment = await this.findOne(companyId, id);
    await this.access.assertAccess(userId, attachment.entityType, "write");
    await this.storage.deleteObject(attachment.storageKey);
    await this.prisma.attachment.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async findOne(companyId: string, id: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!attachment) {
      throw new NotFoundException("Attachment not found");
    }
    return attachment;
  }

  private serialize(attachment: { sizeBytes: bigint; [key: string]: unknown }) {
    return { ...attachment, sizeBytes: Number(attachment.sizeBytes) };
  }
}

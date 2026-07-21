import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { StorageService } from "../../common/storage/storage.service";
import { AttachmentsService } from "./attachments.service";

describe("AttachmentsService", () => {
  let service: AttachmentsService;
  const prisma = {
    attachment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const storage = {
    buildObjectKey: jest.fn(),
    putObject: jest.fn(),
    getSignedDownloadUrl: jest.fn(),
    deleteObject: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    service = moduleRef.get(AttachmentsService);
  });

  it("uploads a file to storage and records it, converting sizeBytes to a plain number", async () => {
    storage.buildObjectKey.mockReturnValue("company-1/abc123.png");
    prisma.attachment.create.mockResolvedValue({
      id: "att-1",
      companyId: "company-1",
      entityType: "User",
      entityId: "user-1",
      sizeBytes: 1234n,
      storageKey: "company-1/abc123.png",
    });

    const result = await service.upload("company-1", "uploader-1", "User", "user-1", {
      originalname: "photo.png",
      mimetype: "image/png",
      size: 1234,
      buffer: Buffer.from("fake"),
    });

    expect(storage.putObject).toHaveBeenCalledWith("company-1/abc123.png", expect.any(Buffer), "image/png");
    expect(prisma.attachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: "company-1", sizeBytes: 1234n }),
      }),
    );
    expect(result.sizeBytes).toBe(1234);
    expect(typeof result.sizeBytes).toBe("number");
  });

  it("rejects files over the size limit before touching storage", async () => {
    await expect(
      service.upload("company-1", "uploader-1", "User", "user-1", {
        originalname: "huge.zip",
        mimetype: "application/zip",
        size: 100 * 1024 * 1024,
        buffer: Buffer.alloc(0),
      }),
    ).rejects.toThrow(/exceeds/);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("scopes list() to the company, entityType, and entityId", async () => {
    prisma.attachment.findMany.mockResolvedValue([{ id: "att-1", sizeBytes: 10n }]);
    const result = await service.list("company-1", "User", "user-1");
    expect(prisma.attachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: "company-1", entityType: "User", entityId: "user-1", deletedAt: null },
      }),
    );
    expect(result[0]?.sizeBytes).toBe(10);
  });

  it("throws NotFoundException for an attachment outside the caller's company", async () => {
    prisma.attachment.findFirst.mockResolvedValue(null);
    await expect(service.getDownloadUrl("company-1", "att-1")).rejects.toThrow(NotFoundException);
  });

  it("removing an attachment deletes the object from storage and soft-deletes the record", async () => {
    prisma.attachment.findFirst.mockResolvedValue({ id: "att-1", storageKey: "company-1/abc123.png" });
    await service.remove("company-1", "att-1");
    expect(storage.deleteObject).toHaveBeenCalledWith("company-1/abc123.png");
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "att-1" }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
  });
});

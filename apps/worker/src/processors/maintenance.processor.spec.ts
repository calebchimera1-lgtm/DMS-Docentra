import { Test } from "@nestjs/testing";
import { JOB_CLEANUP_EXPIRED_SESSIONS } from "@omniflow/shared";
import type { Job } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { MaintenanceProcessor } from "./maintenance.processor";

describe("MaintenanceProcessor", () => {
  let processor: MaintenanceProcessor;
  const prisma = { session: { deleteMany: jest.fn() } };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [MaintenanceProcessor, { provide: PrismaService, useValue: prisma }],
    }).compile();
    processor = moduleRef.get(MaintenanceProcessor);
  });

  it("deletes sessions expired or revoked more than 30 days ago", async () => {
    prisma.session.deleteMany.mockResolvedValue({ count: 3 });

    await processor.process({ name: JOB_CLEANUP_EXPIRED_SESSIONS } as Job);

    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ expiresAt: { lt: expect.any(Date) } }, { revokedAt: { lt: expect.any(Date) } }],
      },
    });
  });

  it("ignores unknown job names without throwing", async () => {
    await expect(processor.process({ name: "some-other-job" } as Job)).resolves.toBeUndefined();
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
  });
});

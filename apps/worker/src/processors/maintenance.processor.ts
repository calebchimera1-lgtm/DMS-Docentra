import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { JOB_BILL_DUE_SUBSCRIPTIONS, JOB_CLEANUP_EXPIRED_SESSIONS, QUEUE_MAINTENANCE } from "@omniflow/shared";
import type { Job } from "bullmq";
import { billDueSubscriptions } from "../billing/bill-due-subscriptions";
import { PrismaService } from "../prisma/prisma.service";

const SESSION_RETENTION_DAYS = 30;

@Processor(QUEUE_MAINTENANCE)
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case JOB_CLEANUP_EXPIRED_SESSIONS:
        await this.cleanupExpiredSessions();
        return;
      case JOB_BILL_DUE_SUBSCRIPTIONS:
        await this.billDueSubscriptions();
        return;
      default:
        this.logger.warn(`Unknown job in ${QUEUE_MAINTENANCE}: ${job.name}`);
    }
  }

  private async billDueSubscriptions(): Promise<void> {
    const { billed, failed } = await billDueSubscriptions(this.prisma);
    this.logger.log(`Recurring billing: ${billed} subscription(s) billed, ${failed} failed`);
  }

  /**
   * Sessions past their expiry (or revoked a while ago) have no further
   * use — deleting them keeps the table from growing unbounded. Recently
   * revoked sessions are kept briefly for support/audit purposes before
   * being swept up here.
   */
  private async cleanupExpiredSessions(): Promise<void> {
    const cutoff = new Date(Date.now() - SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await this.prisma.session.deleteMany({
      where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
    });
    this.logger.log(`Cleaned up ${result.count} expired/revoked session(s)`);
  }
}

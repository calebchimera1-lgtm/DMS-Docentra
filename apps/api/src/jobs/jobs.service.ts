import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import {
  DeliverWebhookJobData,
  JOB_BILL_DUE_SUBSCRIPTIONS,
  JOB_CLEANUP_EXPIRED_SESSIONS,
  JOB_DELIVER_WEBHOOK,
  QUEUE_MAINTENANCE,
  QUEUE_WEBHOOKS,
} from "@omniflow/shared";

const SESSION_CLEANUP_CRON = "0 3 * * *"; // daily at 03:00
const SUBSCRIPTION_BILLING_CRON = "0 2 * * *"; // daily at 02:00, ahead of session cleanup

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue(QUEUE_MAINTENANCE) private readonly maintenanceQueue: Queue,
    @InjectQueue(QUEUE_WEBHOOKS) private readonly webhooksQueue: Queue,
  ) {}

  /** Schedules the recurring housekeeping job once at boot (idempotent — BullMQ dedupes by job id/name+cron). */
  async onModuleInit(): Promise<void> {
    await this.maintenanceQueue.add(
      JOB_CLEANUP_EXPIRED_SESSIONS,
      {},
      { repeat: { pattern: SESSION_CLEANUP_CRON }, jobId: JOB_CLEANUP_EXPIRED_SESSIONS },
    );
    this.logger.log(`Scheduled ${JOB_CLEANUP_EXPIRED_SESSIONS} (${SESSION_CLEANUP_CRON})`);

    // Automatic recurring billing — until this existed, a subscription's
    // "recurring" invoice only ever got raised if someone remembered to
    // call POST /billing/subscriptions/:id/bill by hand.
    await this.maintenanceQueue.add(
      JOB_BILL_DUE_SUBSCRIPTIONS,
      {},
      { repeat: { pattern: SUBSCRIPTION_BILLING_CRON }, jobId: JOB_BILL_DUE_SUBSCRIPTIONS },
    );
    this.logger.log(`Scheduled ${JOB_BILL_DUE_SUBSCRIPTIONS} (${SUBSCRIPTION_BILLING_CRON})`);
  }

  /**
   * Enqueues an outbound webhook delivery rather than calling fetch()
   * inline — keeps external HTTP latency/failures off the request path
   * that triggered the event. Processed by apps/worker, with automatic
   * retry (exponential backoff) since third-party endpoints are
   * unreliable by nature.
   */
  async enqueueWebhookDelivery(data: DeliverWebhookJobData): Promise<void> {
    await this.webhooksQueue.add(JOB_DELIVER_WEBHOOK, data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }
}

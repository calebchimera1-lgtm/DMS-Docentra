import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { JOB_DELIVER_WEBHOOK, QUEUE_WEBHOOKS, type DeliverWebhookJobData } from "@omniflow/shared";
import type { Job } from "bullmq";

const REQUEST_TIMEOUT_MS = 5000;

@Processor(QUEUE_WEBHOOKS)
export class WebhooksProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhooksProcessor.name);

  async process(job: Job<DeliverWebhookJobData>): Promise<void> {
    if (job.name !== JOB_DELIVER_WEBHOOK) {
      this.logger.warn(`Unknown job in ${QUEUE_WEBHOOKS}: ${job.name}`);
      return;
    }
    await this.deliver(job.data);
  }

  private async deliver(data: DeliverWebhookJobData): Promise<void> {
    const url = new URL(data.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      this.logger.error(`Refusing to deliver webhook to non-http(s) URL: ${data.url}`);
      return; // not retryable — a bad URL won't become valid on retry
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Omniflow-Event": data.event },
      body: JSON.stringify({ event: data.event, payload: data.payload }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      // Throwing lets BullMQ's configured retry/backoff (set when the job
      // was enqueued) take over.
      throw new Error(`Webhook delivery to ${url.hostname} failed with status ${res.status}`);
    }
    this.logger.log(`Delivered ${data.event} webhook to ${url.hostname}`);
  }
}

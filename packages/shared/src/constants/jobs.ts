/**
 * Queue and job names — the contract between apps/api (producer) and
 * apps/worker (consumer). Living here rather than duplicated in both
 * keeps them from silently drifting apart.
 */
export const QUEUE_MAINTENANCE = "maintenance";
export const QUEUE_WEBHOOKS = "webhooks";

export const JOB_CLEANUP_EXPIRED_SESSIONS = "cleanup-expired-sessions";
export const JOB_DELIVER_WEBHOOK = "deliver-webhook";
export const JOB_BILL_DUE_SUBSCRIPTIONS = "bill-due-subscriptions";

export interface DeliverWebhookJobData {
  url: string;
  event: string;
  payload: unknown;
}

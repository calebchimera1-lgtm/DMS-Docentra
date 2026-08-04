import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DomainEvents, type NotificationCreatedEvent } from "../../common/events/domain-events";
import { JobsService } from "../../jobs/jobs.service";
import { PluginsService } from "./plugins.service";

const WEBHOOK_NOTIFIER_KEY = "webhook-notifier";

/**
 * The plugin system's extension point: listens to the same domain event
 * bus every other cross-module reaction uses (see
 * NotificationTriggersListener), and for any company with a plugin
 * enabled for that event, hands off to the job queue rather than making
 * the outbound call inline. A second plugin reacting to a second event
 * is a second `@OnEvent` method here plus a catalog entry — the pattern
 * doesn't change.
 */
@Injectable()
export class PluginEventBridgeService {
  private readonly logger = new Logger(PluginEventBridgeService.name);

  constructor(
    private readonly plugins: PluginsService,
    private readonly jobs: JobsService,
  ) {}

  @OnEvent(DomainEvents.NOTIFICATION_CREATED)
  async onNotificationCreated({ notification }: NotificationCreatedEvent): Promise<void> {
    const config = await this.plugins.getEnabledConfig(notification.companyId, WEBHOOK_NOTIFIER_KEY);
    const webhookUrl = config?.webhookUrl;
    if (typeof webhookUrl !== "string" || !webhookUrl) {
      return;
    }

    await this.jobs.enqueueWebhookDelivery({
      url: webhookUrl,
      event: DomainEvents.NOTIFICATION_CREATED,
      payload: {
        title: notification.title,
        body: notification.body,
        type: notification.type,
        createdAt: notification.createdAt,
      },
    });
    this.logger.debug(`Queued webhook delivery for company ${notification.companyId}`);
  }
}

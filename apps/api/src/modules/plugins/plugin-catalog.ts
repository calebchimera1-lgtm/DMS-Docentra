/**
 * The built-in plugin catalog, seeded on boot (same pattern as
 * PermissionsService). A "plugin" here is intentionally lightweight: a
 * key the event bridge (plugin-event-bridge.service.ts) checks before
 * reacting to a domain event for a given company. Real integrations
 * (Slack, Zapier, a custom ERP module) register themselves the same way
 * — add a catalog entry and a branch in the event bridge (or, for a
 * fully out-of-process plugin, just an event bridge branch that enqueues
 * a webhook to it).
 */
export interface PluginDefinition {
  key: string;
  name: string;
  description: string;
  version: string;
  author?: string;
}

export const PLUGIN_CATALOG: PluginDefinition[] = [
  {
    key: "webhook-notifier",
    name: "Webhook Notifier",
    description:
      "POSTs a JSON payload to a configured URL whenever a notification is created for this company " +
      "(new user welcomed, role granted, etc.) — the generic integration point for Slack, Zapier, or a custom listener.",
    version: "0.1.0",
    author: "Omniflow",
  },
];

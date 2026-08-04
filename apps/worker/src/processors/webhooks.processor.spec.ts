import { JOB_DELIVER_WEBHOOK, type DeliverWebhookJobData } from "@omniflow/shared";
import type { Job } from "bullmq";
import { WebhooksProcessor } from "./webhooks.processor";

describe("WebhooksProcessor", () => {
  let processor: WebhooksProcessor;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    processor = new WebhooksProcessor();
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function job(data: DeliverWebhookJobData): Job<DeliverWebhookJobData> {
    return { name: JOB_DELIVER_WEBHOOK, data } as Job<DeliverWebhookJobData>;
  }

  it("POSTs the event and payload as JSON to the configured URL", async () => {
    fetchSpy.mockResolvedValue({ ok: true, status: 200 } as Response);

    await processor.process(
      job({ url: "https://example.com/hook", event: "notification.created", payload: { title: "Hi" } }),
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url.toString()).toBe("https://example.com/hook");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      event: "notification.created",
      payload: { title: "Hi" },
    });
  });

  it("throws on a non-2xx response so BullMQ retries", async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500 } as Response);

    await expect(
      processor.process(job({ url: "https://example.com/hook", event: "x", payload: {} })),
    ).rejects.toThrow(/status 500/);
  });

  it("refuses non-http(s) URLs without retrying (not a transient failure)", async () => {
    await processor.process(job({ url: "file:///etc/passwd", event: "x", payload: {} }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ignores unrelated job names", async () => {
    await processor.process({ name: "some-other-job" } as Job<DeliverWebhookJobData>);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

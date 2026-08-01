import { NotFoundException } from "@nestjs/common";
import { ManualPaymentProvider } from "./manual-payment.provider";
import { PaymentProviderRegistry } from "./payment-provider.registry";

describe("PaymentProviderRegistry", () => {
  it("resolves the manual provider by default", () => {
    const registry = new PaymentProviderRegistry(new ManualPaymentProvider());
    const provider = registry.resolve();
    expect(provider.key).toBe("manual");
  });

  it("resolves a provider by explicit key", () => {
    const registry = new PaymentProviderRegistry(new ManualPaymentProvider());
    expect(registry.resolve("manual").key).toBe("manual");
  });

  it("throws for an unregistered provider key", () => {
    const registry = new PaymentProviderRegistry(new ManualPaymentProvider());
    expect(() => registry.resolve("stripe")).toThrow(NotFoundException);
  });

  it("lists every registered provider", () => {
    const registry = new PaymentProviderRegistry(new ManualPaymentProvider());
    expect(registry.list().map((p) => p.key)).toEqual(["manual"]);
  });
});

describe("ManualPaymentProvider", () => {
  it("never reports a charge as succeeded", async () => {
    const provider = new ManualPaymentProvider();
    const result = await provider.charge({
      companyId: "company-1",
      amountCents: 5000,
      currency: "USD",
      reference: "INV-000001",
      description: "Pro subscription",
    });
    expect(result.status).toBe("PENDING");
    expect(result.providerReference).toBeNull();
    expect(result.message).toContain("INV-000001");
  });
});

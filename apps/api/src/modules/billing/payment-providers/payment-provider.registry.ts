import { Injectable, NotFoundException } from "@nestjs/common";
import { ManualPaymentProvider } from "./manual-payment.provider";
import type { PaymentProvider } from "./payment-provider.interface";

/**
 * Every registered PaymentProvider, keyed by PaymentProvider.key. A
 * future Stripe/PayPal/M-Pesa integration adds itself to `providers`
 * here (and to BillingModule's provider list) — nothing else in the
 * billing flow needs to change, since callers resolve a provider by key
 * through this registry rather than injecting a concrete class.
 */
@Injectable()
export class PaymentProviderRegistry {
  private readonly providers: Map<string, PaymentProvider>;

  constructor(manual: ManualPaymentProvider) {
    this.providers = new Map<string, PaymentProvider>([[manual.key, manual]]);
  }

  list(): PaymentProvider[] {
    return [...this.providers.values()];
  }

  resolve(key: string = "manual"): PaymentProvider {
    const provider = this.providers.get(key);
    if (!provider) {
      throw new NotFoundException(
        `Unknown payment provider: ${key}. Registered: ${[...this.providers.keys()].join(", ")}`,
      );
    }
    return provider;
  }
}

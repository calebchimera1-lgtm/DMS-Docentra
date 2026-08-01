import { Injectable } from "@nestjs/common";
import type { PaymentChargeRequest, PaymentChargeResult, PaymentProvider } from "./payment-provider.interface";

/**
 * The only PaymentProvider registered today. It never actually moves
 * money — every charge attempt comes back PENDING, meaning "collect this
 * one manually" (record it in Accounting as a Payment against the
 * invoice's Accounts Receivable, the same way payments are recorded
 * today). This is the honest default until a real gateway is wired up:
 * it completes the PaymentProvider contract without pretending a charge
 * happened.
 */
@Injectable()
export class ManualPaymentProvider implements PaymentProvider {
  readonly key = "manual";
  readonly displayName = "Manual collection";

  async charge(request: PaymentChargeRequest): Promise<PaymentChargeResult> {
    return {
      status: "PENDING",
      providerReference: null,
      message: `No payment gateway is configured — collect ${request.reference} manually and record it as a Payment in Accounting.`,
    };
  }
}

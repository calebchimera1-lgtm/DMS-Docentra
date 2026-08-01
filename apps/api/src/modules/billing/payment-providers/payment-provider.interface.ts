/**
 * The seam a real payment gateway (Stripe, PayPal, M-Pesa) plugs into.
 * Nothing in this codebase charges real money yet — ManualPaymentProvider
 * is the only implementation, and it never reports a charge as
 * succeeded. A future gateway integration implements this interface,
 * registers itself in PaymentProviderRegistry, and every call site that
 * already goes through the registry (subscription payment collection)
 * starts using it without further changes.
 */
export interface PaymentChargeRequest {
  companyId: string;
  /** Amount to charge, in the smallest currency unit (e.g. cents). */
  amountCents: number;
  currency: string;
  /** Human-readable reference tying the charge back to what it's for, e.g. an invoice number. */
  reference: string;
  description: string;
}

export type PaymentChargeStatus = "SUCCEEDED" | "FAILED" | "PENDING";

export interface PaymentChargeResult {
  status: PaymentChargeStatus;
  /** The provider's own identifier for this attempt, if any (a gateway transaction id, for example). */
  providerReference: string | null;
  message: string;
}

export interface PaymentProvider {
  /** Stable key this provider is registered under, e.g. "manual", "stripe", "mpesa". */
  readonly key: string;
  readonly displayName: string;
  charge(request: PaymentChargeRequest): Promise<PaymentChargeResult>;
}

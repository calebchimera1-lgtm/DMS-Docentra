import type { PaymentType } from "./payment.type";

interface PrismaPaymentWithRelations {
  id: string;
  amountCents: number;
  currency: string;
  method: string;
  paymentDate: Date;
  reference: string | null;
  invoice: { id: string; invoiceNumber: string } | null;
}

export function toPaymentType(payment: PrismaPaymentWithRelations): PaymentType {
  return {
    id: payment.id,
    amountCents: payment.amountCents,
    currency: payment.currency,
    method: payment.method,
    paymentDate: payment.paymentDate,
    reference: payment.reference ?? undefined,
    invoiceNumber: payment.invoice?.invoiceNumber,
  };
}

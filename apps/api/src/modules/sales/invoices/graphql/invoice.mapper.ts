import type { PricedLineItem } from "../../common/line-item.dto";
import type { InvoiceType } from "./invoice.type";

interface PrismaInvoiceWithRelations {
  id: string;
  invoiceNumber: string;
  status: string;
  items: unknown;
  totalCents: number;
  currency: string;
  dueDate: Date | null;
  paidAt: Date | null;
  account: { id: string; name: string } | null;
}

export function toInvoiceType(invoice: PrismaInvoiceWithRelations): InvoiceType {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    items: invoice.items as PricedLineItem[],
    totalCents: invoice.totalCents,
    currency: invoice.currency,
    dueDate: invoice.dueDate ?? undefined,
    paidAt: invoice.paidAt ?? undefined,
    account: invoice.account ?? undefined,
  };
}

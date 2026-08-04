import type { PricedLineItem } from "../../common/line-item.dto";
import type { QuoteType } from "./quote.type";

interface PrismaQuoteWithRelations {
  id: string;
  quoteNumber: string;
  status: string;
  items: unknown;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  account: { id: string; name: string } | null;
}

export function toQuoteType(quote: PrismaQuoteWithRelations): QuoteType {
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    items: quote.items as PricedLineItem[],
    subtotalCents: quote.subtotalCents,
    discountCents: quote.discountCents,
    taxCents: quote.taxCents,
    totalCents: quote.totalCents,
    currency: quote.currency,
    account: quote.account ?? undefined,
  };
}

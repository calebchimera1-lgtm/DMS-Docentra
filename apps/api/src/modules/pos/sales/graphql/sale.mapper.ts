import type { PosSaleItemType } from "./sale.type";

interface PrismaSaleWithRelations {
  id: string;
  saleNumber: string;
  totalCents: number;
  currency: string;
  paymentMethod: string;
  status: string;
  session: { id: string; sessionNumber: string };
  account: { id: string; name: string } | null;
}

export function toSaleItemType(sale: PrismaSaleWithRelations): PosSaleItemType {
  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    totalCents: sale.totalCents,
    currency: sale.currency,
    paymentMethod: sale.paymentMethod,
    status: sale.status,
    session: sale.session,
    account: sale.account ?? undefined,
  };
}

import type { PricedLineItem } from "../../common/line-item.dto";
import type { SalesOrderType } from "./order.type";

interface PrismaOrderWithRelations {
  id: string;
  orderNumber: string;
  status: string;
  items: unknown;
  totalCents: number;
  currency: string;
  account: { id: string; name: string } | null;
}

export function toSalesOrderType(order: PrismaOrderWithRelations): SalesOrderType {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    items: order.items as PricedLineItem[],
    totalCents: order.totalCents,
    currency: order.currency,
    account: order.account ?? undefined,
  };
}

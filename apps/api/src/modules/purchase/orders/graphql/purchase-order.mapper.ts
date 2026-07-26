import type { PurchaseOrderItemType } from "./purchase-order.type";

interface PrismaPurchaseOrderWithRelations {
  id: string;
  orderNumber: string;
  status: string;
  items: unknown;
  subtotalCents: number;
  totalCents: number;
  currency: string;
  expectedDate: Date | null;
  createdAt: Date;
  supplier: { id: string; name: string; code: string };
  warehouse: { id: string; name: string; code: string } | null;
}

export function toPurchaseOrderItemType(order: PrismaPurchaseOrderWithRelations): PurchaseOrderItemType {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    items: order.items as PurchaseOrderItemType["items"],
    subtotalCents: order.subtotalCents,
    totalCents: order.totalCents,
    currency: order.currency,
    expectedDate: order.expectedDate ?? undefined,
    supplier: order.supplier,
    warehouse: order.warehouse ?? undefined,
    createdAt: order.createdAt,
  };
}

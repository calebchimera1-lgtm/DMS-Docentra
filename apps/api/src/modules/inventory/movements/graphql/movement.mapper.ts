import type { StockMovementItemType } from "./movement.type";

interface PrismaMovementWithRelations {
  id: string;
  type: string;
  quantity: number;
  reference: string | null;
  createdAt: Date;
  product: { id: string; sku: string; name: string };
  warehouse: { id: string; name: string; code: string };
}

export function toStockMovementItemType(movement: PrismaMovementWithRelations): StockMovementItemType {
  return {
    id: movement.id,
    type: movement.type,
    quantity: movement.quantity,
    reference: movement.reference ?? undefined,
    product: movement.product,
    warehouse: movement.warehouse,
    createdAt: movement.createdAt,
  };
}

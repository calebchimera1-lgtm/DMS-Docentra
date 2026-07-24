import type { StockItemType } from "./stock-item.type";

interface PrismaStockItemWithRelations {
  id: string;
  quantityOnHand: number;
  reorderPoint: number;
  reorderQuantity: number;
  product: { id: string; sku: string; name: string };
  warehouse: { id: string; name: string; code: string };
}

export function toStockItemType(item: PrismaStockItemWithRelations): StockItemType {
  return {
    id: item.id,
    quantityOnHand: item.quantityOnHand,
    reorderPoint: item.reorderPoint,
    reorderQuantity: item.reorderQuantity,
    product: item.product,
    warehouse: item.warehouse,
  };
}

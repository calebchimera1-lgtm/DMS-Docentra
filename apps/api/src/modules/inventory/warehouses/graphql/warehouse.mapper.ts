import type { WarehouseType } from "./warehouse.type";

interface PrismaWarehouseWithRelations {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
  _count?: { stockItems: number };
}

export function toWarehouseType(warehouse: PrismaWarehouseWithRelations): WarehouseType {
  return {
    id: warehouse.id,
    name: warehouse.name,
    code: warehouse.code,
    address: warehouse.address ?? undefined,
    isActive: warehouse.isActive,
    stockItemCount: warehouse._count?.stockItems,
  };
}

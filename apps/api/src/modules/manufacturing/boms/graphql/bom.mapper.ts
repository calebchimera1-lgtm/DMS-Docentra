import type { BomItemType } from "./bom.type";

interface PrismaBomWithRelations {
  id: string;
  name: string;
  isActive: boolean;
  product: { id: string; sku: string; name: string };
  lines: { id: string; quantity: number; componentProduct: { id: string; sku: string; name: string } }[];
}

export function toBomItemType(bom: PrismaBomWithRelations): BomItemType {
  return {
    id: bom.id,
    name: bom.name,
    isActive: bom.isActive,
    product: bom.product,
    lines: bom.lines.map((line) => ({
      id: line.id,
      quantity: line.quantity,
      componentProduct: line.componentProduct,
    })),
  };
}

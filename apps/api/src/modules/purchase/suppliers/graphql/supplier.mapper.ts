import type { SupplierItemType } from "./supplier.type";

interface PrismaSupplier {
  id: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
}

export function toSupplierItemType(supplier: PrismaSupplier): SupplierItemType {
  return {
    id: supplier.id,
    name: supplier.name,
    code: supplier.code,
    email: supplier.email ?? undefined,
    phone: supplier.phone ?? undefined,
    isActive: supplier.isActive,
  };
}

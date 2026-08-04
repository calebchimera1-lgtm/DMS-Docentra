import type { SalaryComponentItemType } from "./salary-component.type";

interface PrismaSalaryComponent {
  id: string;
  name: string;
  code: string;
  type: string;
  calculationType: string;
  value: number;
  isActive: boolean;
}

export function toSalaryComponentItemType(component: PrismaSalaryComponent): SalaryComponentItemType {
  return {
    id: component.id,
    name: component.name,
    code: component.code,
    type: component.type,
    calculationType: component.calculationType,
    value: component.value,
    isActive: component.isActive,
  };
}

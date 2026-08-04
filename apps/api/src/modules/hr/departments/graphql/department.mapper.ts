import type { DepartmentItemType } from "./department.type";

interface PrismaDepartmentWithRelations {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  manager: { id: string; employeeNumber: string; firstName: string; lastName: string } | null;
}

export function toDepartmentItemType(department: PrismaDepartmentWithRelations): DepartmentItemType {
  return {
    id: department.id,
    name: department.name,
    code: department.code,
    isActive: department.isActive,
    manager: department.manager ?? undefined,
  };
}

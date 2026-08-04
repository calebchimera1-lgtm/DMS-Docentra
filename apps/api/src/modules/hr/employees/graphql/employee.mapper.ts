import type { EmployeeItemType } from "./employee.type";

interface PrismaEmployeeWithRelations {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  employmentType: string;
  status: string;
  hireDate: Date;
  terminationDate: Date | null;
  salaryCents: number | null;
  currency: string;
  department: { id: string; name: string; code: string } | null;
  manager: { id: string; employeeNumber: string; firstName: string; lastName: string } | null;
}

export function toEmployeeItemType(employee: PrismaEmployeeWithRelations): EmployeeItemType {
  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email ?? undefined,
    phone: employee.phone ?? undefined,
    jobTitle: employee.jobTitle ?? undefined,
    employmentType: employee.employmentType,
    status: employee.status,
    hireDate: employee.hireDate,
    terminationDate: employee.terminationDate ?? undefined,
    salaryCents: employee.salaryCents ?? undefined,
    currency: employee.currency,
    department: employee.department ?? undefined,
    manager: employee.manager ?? undefined,
  };
}

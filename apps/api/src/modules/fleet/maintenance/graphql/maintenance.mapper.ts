import type { MaintenanceItemType } from "./maintenance.type";

interface PrismaMaintenanceWithRelations {
  id: string;
  type: string;
  status: string;
  scheduledDate: Date;
  costCents: number | null;
  vehicle: { id: string; registrationNumber: string };
}

export function toMaintenanceItemType(record: PrismaMaintenanceWithRelations): MaintenanceItemType {
  return {
    id: record.id,
    type: record.type,
    status: record.status,
    scheduledDate: record.scheduledDate,
    costCents: record.costCents ?? undefined,
    vehicle: record.vehicle,
  };
}

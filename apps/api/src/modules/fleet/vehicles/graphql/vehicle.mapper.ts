import type { VehicleItemType } from "./vehicle.type";

interface PrismaVehicleWithRelations {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: number | null;
  status: string;
  odometerReading: number;
  assignedDriver: { id: string; employeeNumber: string; firstName: string; lastName: string } | null;
}

export function toVehicleItemType(vehicle: PrismaVehicleWithRelations): VehicleItemType {
  return {
    id: vehicle.id,
    registrationNumber: vehicle.registrationNumber,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year ?? undefined,
    status: vehicle.status,
    odometerReading: vehicle.odometerReading,
    assignedDriver: vehicle.assignedDriver ?? undefined,
  };
}

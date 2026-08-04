import type { TripItemType } from "./trip.type";

interface PrismaTripWithRelations {
  id: string;
  status: string;
  startOdometer: number;
  endOdometer: number | null;
  distance: number | null;
  vehicle: { id: string; registrationNumber: string };
  driver: { id: string; firstName: string; lastName: string } | null;
}

export function toTripItemType(trip: PrismaTripWithRelations): TripItemType {
  return {
    id: trip.id,
    status: trip.status,
    startOdometer: trip.startOdometer,
    endOdometer: trip.endOdometer ?? undefined,
    distance: trip.distance ?? undefined,
    vehicle: trip.vehicle,
    driver: trip.driver ?? undefined,
  };
}

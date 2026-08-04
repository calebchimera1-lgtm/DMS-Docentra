import type { ShipmentItemType } from "./shipment.type";

interface PrismaShipmentWithRelations {
  id: string;
  shipmentNumber: string;
  status: string;
  destinationAddress: string;
  items: unknown;
  dispatchedAt: Date | null;
  deliveredAt: Date | null;
  failureReason: string | null;
  warehouse: { id: string; name: string; code: string };
  account: { id: string; name: string } | null;
  vehicle: { id: string; registrationNumber: string } | null;
  driver: { id: string; firstName: string; lastName: string } | null;
  events: { id: string; status: string; location: string | null; note: string | null; occurredAt: Date }[];
}

export function toShipmentItemType(shipment: PrismaShipmentWithRelations): ShipmentItemType {
  return {
    id: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    status: shipment.status,
    destinationAddress: shipment.destinationAddress,
    itemCount: Array.isArray(shipment.items) ? shipment.items.length : 0,
    dispatchedAt: shipment.dispatchedAt ?? undefined,
    deliveredAt: shipment.deliveredAt ?? undefined,
    failureReason: shipment.failureReason ?? undefined,
    warehouse: shipment.warehouse,
    account: shipment.account ?? undefined,
    vehicle: shipment.vehicle ?? undefined,
    driver: shipment.driver ?? undefined,
    events: shipment.events.map((e) => ({
      id: e.id,
      status: e.status,
      location: e.location ?? undefined,
      note: e.note ?? undefined,
      occurredAt: e.occurredAt,
    })),
  };
}

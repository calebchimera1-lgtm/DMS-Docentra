"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../../lib/api-client";
import { formatCents } from "../../../../../lib/format";
import type { Shipment } from "../../../../../lib/types";
import { LogisticsSubnav } from "../../../../../components/logistics/logistics-subnav";

export default function ShipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    void apiClient
      .get<Shipment>(`/logistics/shipments/${params.id}`)
      .then(setShipment)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load shipment"));
  }, [params?.id]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Logistics</h1>
        <p className="text-sm text-muted-foreground">
          Shipments from warehouse to doorstep, with a full delivery tracking timeline.
        </p>
      </div>

      <LogisticsSubnav />

      <Link href="/logistics/shipments">
        <Button type="button" variant="outline" size="sm">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Back to shipments
        </Button>
      </Link>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {shipment === null ? (
        !error && <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {shipment.shipmentNumber}
                <Badge variant={shipment.status === "DELIVERED" ? "default" : "outline"}>{shipment.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Destination</dt>
                  <dd className="text-foreground">{shipment.destinationAddress}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Contact</dt>
                  <dd className="text-foreground">{shipment.contactName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Origin warehouse</dt>
                  <dd className="text-foreground">{shipment.warehouse.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Vehicle</dt>
                  <dd className="text-foreground">{shipment.vehicle?.registrationNumber ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Driver</dt>
                  <dd className="text-foreground">
                    {shipment.driver ? `${shipment.driver.firstName} ${shipment.driver.lastName}` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Fleet trip</dt>
                  <dd className="text-foreground">
                    {shipment.trip ? `${shipment.trip.status} (from ${shipment.trip.startOdometer} km)` : "—"}
                  </dd>
                </div>
                {shipment.failureReason && (
                  <div className="sm:col-span-3">
                    <dt className="text-muted-foreground">Failure reason</dt>
                    <dd className="text-red-600">{shipment.failureReason}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-4">
                {shipment.events.map((event) => (
                  <li key={event.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">{event.status}</span>
                      {event.location && <span className="text-sm text-muted-foreground">{event.location}</span>}
                      {event.note && <span className="text-sm text-muted-foreground">{event.note}</span>}
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.occurredAt).toLocaleString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Description</th>
                    <th className="p-3 font-medium">Quantity</th>
                    <th className="p-3 font-medium">Unit price</th>
                    <th className="p-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {shipment.items.map((item, index) => (
                    <tr key={index} className="border-b border-border last:border-0">
                      <td className="p-3 text-foreground">{item.description}</td>
                      <td className="p-3 text-muted-foreground">{item.quantity}</td>
                      <td className="p-3 text-muted-foreground">{formatCents(item.unitPriceCents)}</td>
                      <td className="p-3 text-muted-foreground">{formatCents(item.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

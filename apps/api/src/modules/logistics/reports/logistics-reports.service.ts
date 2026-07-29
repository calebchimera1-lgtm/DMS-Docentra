import { Injectable } from "@nestjs/common";
import type { ShipmentStatus } from "@omniflow/database";
import { PrismaService } from "../../../prisma/prisma.service";

const SHIPMENT_STATUSES: ShipmentStatus[] = [
  "DRAFT",
  "DISPATCHED",
  "IN_TRANSIT",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
];

@Injectable()
export class LogisticsReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(companyId: string) {
    const base = { companyId, deletedAt: null };
    const [draftCount, inFlightCount, deliveredCount, failedCount, totalCount] = await Promise.all([
      this.prisma.shipment.count({ where: { ...base, status: "DRAFT" } }),
      this.prisma.shipment.count({ where: { ...base, status: { in: ["DISPATCHED", "IN_TRANSIT"] } } }),
      this.prisma.shipment.count({ where: { ...base, status: "DELIVERED" } }),
      this.prisma.shipment.count({ where: { ...base, status: "FAILED" } }),
      this.prisma.shipment.count({ where: base }),
    ]);

    // Share of finished attempts that actually arrived. Draft, in-flight, and
    // cancelled shipments are excluded — none of them represent a delivery
    // attempt that has run its course, so folding them in would understate it.
    const attempted = deliveredCount + failedCount;
    const deliveredRatePercent = attempted === 0 ? 0 : Math.round((deliveredCount / attempted) * 100);

    return { draftCount, inFlightCount, deliveredCount, failedCount, totalCount, deliveredRatePercent };
  }

  async byStatus(companyId: string) {
    const grouped = await this.prisma.shipment.groupBy({
      by: ["status"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    });
    const countByStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
    return SHIPMENT_STATUSES.map((status) => ({ status, count: countByStatus.get(status) ?? 0 }));
  }
}

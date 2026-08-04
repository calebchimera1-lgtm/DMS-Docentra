import { Injectable } from "@nestjs/common";
import type { VehicleStatus } from "@omniflow/database";
import { PrismaService } from "../../../prisma/prisma.service";

const VEHICLE_STATUSES: VehicleStatus[] = ["ACTIVE", "IN_MAINTENANCE", "RETIRED"];

@Injectable()
export class FleetReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(companyId: string) {
    const [activeCount, inMaintenanceCount, retiredCount, tripsInProgressCount, distanceAgg] = await Promise.all([
      this.prisma.vehicle.count({ where: { companyId, deletedAt: null, status: "ACTIVE" } }),
      this.prisma.vehicle.count({ where: { companyId, deletedAt: null, status: "IN_MAINTENANCE" } }),
      this.prisma.vehicle.count({ where: { companyId, deletedAt: null, status: "RETIRED" } }),
      this.prisma.trip.count({ where: { companyId, deletedAt: null, status: "IN_PROGRESS" } }),
      this.prisma.trip.aggregate({
        where: { companyId, deletedAt: null, status: "COMPLETED" },
        _sum: { distance: true },
      }),
    ]);

    return {
      activeCount,
      inMaintenanceCount,
      retiredCount,
      tripsInProgressCount,
      totalDistanceAllTime: distanceAgg._sum.distance ?? 0,
    };
  }

  async byStatus(companyId: string) {
    const grouped = await this.prisma.vehicle.groupBy({
      by: ["status"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    });
    const countByStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
    return VEHICLE_STATUSES.map((status) => ({ status, count: countByStatus.get(status) ?? 0 }));
  }
}

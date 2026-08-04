import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CompleteTripDto } from "./dto/complete-trip.dto";
import type { CreateTripDto } from "./dto/create-trip.dto";
import type { ListTripsQueryDto } from "./dto/list-trips-query.dto";

const EXPORT_ROW_LIMIT = 5000;

const tripInclude = {
  vehicle: { select: { id: true, registrationNumber: true, make: true, model: true } },
  driver: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListTripsQueryDto, "status" | "vehicleId">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
    };
  }

  async list(companyId: string, query: ListTripsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        include: tripInclude,
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.trip.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { id, companyId, deletedAt: null },
      include: tripInclude,
    });
    if (!trip) {
      throw new NotFoundException("Trip not found");
    }
    return trip;
  }

  /**
   * Logging a trip has no draft stage — `create` is already the start: it
   * snapshots the vehicle's current odometer reading as `startOdometer`.
   */
  async create(companyId: string, dto: CreateTripDto) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, companyId, deletedAt: null },
    });
    if (!vehicle) {
      throw new BadRequestException("Vehicle does not belong to this company");
    }
    if (vehicle.status !== "ACTIVE") {
      throw new BadRequestException(`A vehicle that is ${vehicle.status.toLowerCase()} cannot start a trip`);
    }

    const driverId = dto.driverId ?? vehicle.assignedDriverId ?? undefined;
    if (driverId) {
      const driverCount = await this.prisma.employee.count({ where: { id: driverId, companyId, deletedAt: null } });
      if (driverCount === 0) {
        throw new BadRequestException("Driver does not belong to this company");
      }
    }

    return this.prisma.trip.create({
      data: {
        companyId,
        vehicleId: dto.vehicleId,
        driverId,
        purpose: dto.purpose,
        startOdometer: vehicle.odometerReading,
      },
      include: tripInclude,
    });
  }

  /**
   * Validates `endOdometer` against the trip's own `startOdometer`
   * snapshot, computes `distance`, and updates the vehicle's own
   * `odometerReading` — the same "reuse the resource's own cache-update
   * logic" convention every stock-moving action in this codebase follows.
   */
  async complete(companyId: string, id: string, dto: CompleteTripDto) {
    const trip = await this.findOne(companyId, id);
    if (trip.status !== "IN_PROGRESS") {
      throw new BadRequestException("Only an in-progress trip can be completed");
    }
    if (dto.endOdometer < trip.startOdometer) {
      throw new BadRequestException(
        `End odometer (${dto.endOdometer}) cannot be less than the start odometer (${trip.startOdometer})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.vehicle.update({ where: { id: trip.vehicleId }, data: { odometerReading: dto.endOdometer } });
      return tx.trip.update({
        where: { id },
        data: {
          status: "COMPLETED",
          endOdometer: dto.endOdometer,
          distance: dto.endOdometer - trip.startOdometer,
          endedAt: new Date(),
        },
        include: tripInclude,
      });
    });
  }

  async cancel(companyId: string, id: string) {
    const trip = await this.findOne(companyId, id);
    if (trip.status !== "IN_PROGRESS") {
      throw new BadRequestException("Only an in-progress trip can be cancelled");
    }
    return this.prisma.trip.update({
      where: { id },
      data: { status: "CANCELLED", endedAt: new Date() },
      include: tripInclude,
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    const trip = await this.findOne(companyId, id);
    if (trip.status === "IN_PROGRESS") {
      throw new ForbiddenException("An in-progress trip cannot be deleted");
    }
    await this.prisma.trip.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(companyId: string, query: Pick<ListTripsQueryDto, "status" | "vehicleId">): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.trip.findMany({
      where,
      include: tripInclude,
      orderBy: { startedAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      vehicle: r.vehicle.registrationNumber,
      driver: r.driver ? `${r.driver.firstName} ${r.driver.lastName}` : "",
      purpose: r.purpose ?? "",
      startOdometer: r.startOdometer,
      endOdometer: r.endOdometer ?? "",
      distance: r.distance ?? "",
      status: r.status,
    }));
    return toCsv(flat, ["vehicle", "driver", "purpose", "startOdometer", "endOdometer", "distance", "status"]);
  }
}

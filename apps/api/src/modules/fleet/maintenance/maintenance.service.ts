import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CompleteMaintenanceDto } from "./dto/complete-maintenance.dto";
import type { CreateMaintenanceDto } from "./dto/create-maintenance.dto";
import type { ListMaintenanceQueryDto } from "./dto/list-maintenance-query.dto";

const EXPORT_ROW_LIMIT = 5000;

const maintenanceInclude = {
  vehicle: { select: { id: true, registrationNumber: true, make: true, model: true } },
} as const;

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListMaintenanceQueryDto, "status" | "type" | "vehicleId">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
    };
  }

  async list(companyId: string, query: ListMaintenanceQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.maintenanceRecord.findMany({
        where,
        include: maintenanceInclude,
        orderBy: { scheduledDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.maintenanceRecord.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const record = await this.prisma.maintenanceRecord.findFirst({
      where: { id, companyId, deletedAt: null },
      include: maintenanceInclude,
    });
    if (!record) {
      throw new NotFoundException("Maintenance record not found");
    }
    return record;
  }

  async create(companyId: string, dto: CreateMaintenanceDto) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, companyId, deletedAt: null },
    });
    if (!vehicle) {
      throw new BadRequestException("Vehicle does not belong to this company");
    }

    return this.prisma.maintenanceRecord.create({
      data: {
        companyId,
        vehicleId: dto.vehicleId,
        type: dto.type,
        scheduledDate: new Date(dto.scheduledDate),
        description: dto.description,
      },
      include: maintenanceInclude,
    });
  }

  /** Flips the vehicle's own status to IN_MAINTENANCE — a real cross-entity side effect. */
  async start(companyId: string, id: string) {
    const record = await this.findOne(companyId, id);
    if (record.status !== "SCHEDULED") {
      throw new BadRequestException("Only a scheduled maintenance job can be started");
    }
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id: record.vehicleId, companyId } });
    if (!vehicle) {
      throw new NotFoundException("Vehicle not found");
    }
    if (vehicle.status === "IN_MAINTENANCE") {
      throw new BadRequestException("This vehicle already has a maintenance job in progress");
    }
    if (vehicle.status === "RETIRED") {
      throw new BadRequestException("A retired vehicle cannot undergo maintenance");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.vehicle.update({ where: { id: record.vehicleId }, data: { status: "IN_MAINTENANCE" } });
      return tx.maintenanceRecord.update({
        where: { id },
        data: { status: "IN_PROGRESS" },
        include: maintenanceInclude,
      });
    });
  }

  /** Flips the vehicle's own status back to ACTIVE and records the actual completion date/cost. */
  async complete(companyId: string, id: string, dto: CompleteMaintenanceDto) {
    const record = await this.findOne(companyId, id);
    if (record.status !== "IN_PROGRESS") {
      throw new BadRequestException("Only an in-progress maintenance job can be completed");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.vehicle.update({ where: { id: record.vehicleId }, data: { status: "ACTIVE" } });
      return tx.maintenanceRecord.update({
        where: { id },
        data: { status: "COMPLETED", completedDate: new Date(), costCents: dto.costCents },
        include: maintenanceInclude,
      });
    });
  }

  async cancel(companyId: string, id: string) {
    const record = await this.findOne(companyId, id);
    if (record.status !== "SCHEDULED" && record.status !== "IN_PROGRESS") {
      throw new BadRequestException("Only a scheduled or in-progress maintenance job can be cancelled");
    }

    return this.prisma.$transaction(async (tx) => {
      if (record.status === "IN_PROGRESS") {
        await tx.vehicle.update({ where: { id: record.vehicleId }, data: { status: "ACTIVE" } });
      }
      return tx.maintenanceRecord.update({
        where: { id },
        data: { status: "CANCELLED" },
        include: maintenanceInclude,
      });
    });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListMaintenanceQueryDto, "status" | "type" | "vehicleId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.maintenanceRecord.findMany({
      where,
      include: maintenanceInclude,
      orderBy: { scheduledDate: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      vehicle: r.vehicle.registrationNumber,
      type: r.type,
      status: r.status,
      scheduledDate: r.scheduledDate,
      completedDate: r.completedDate ?? "",
      costCents: r.costCents ?? "",
    }));
    return toCsv(flat, ["vehicle", "type", "status", "scheduledDate", "completedDate", "costCents"]);
  }
}

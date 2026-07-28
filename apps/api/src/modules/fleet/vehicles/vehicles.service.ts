import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreateVehicleDto } from "./dto/create-vehicle.dto";
import type { ListVehiclesQueryDto } from "./dto/list-vehicles-query.dto";
import type { UpdateVehicleDto } from "./dto/update-vehicle.dto";

const EXPORT_ROW_LIMIT = 5000;

const vehicleInclude = {
  assignedDriver: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListVehiclesQueryDto, "search" | "status">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { registrationNumber: { contains: query.search, mode: "insensitive" as const } },
              { make: { contains: query.search, mode: "insensitive" as const } },
              { model: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };
  }

  private async assertDriverBelongsToCompany(companyId: string, employeeId: string): Promise<void> {
    const count = await this.prisma.employee.count({ where: { id: employeeId, companyId, deletedAt: null } });
    if (count === 0) {
      throw new BadRequestException("Driver does not belong to this company");
    }
  }

  async list(companyId: string, query: ListVehiclesQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        include: vehicleInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, companyId, deletedAt: null },
      include: vehicleInclude,
    });
    if (!vehicle) {
      throw new NotFoundException("Vehicle not found");
    }
    return vehicle;
  }

  async create(companyId: string, dto: CreateVehicleDto) {
    if (dto.assignedDriverId) {
      await this.assertDriverBelongsToCompany(companyId, dto.assignedDriverId);
    }
    return this.prisma.vehicle.create({
      data: {
        companyId,
        registrationNumber: dto.registrationNumber,
        make: dto.make,
        model: dto.model,
        year: dto.year,
        odometerReading: dto.odometerReading ?? 0,
        fuelType: dto.fuelType,
        assignedDriverId: dto.assignedDriverId,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        note: dto.note,
      },
      include: vehicleInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdateVehicleDto) {
    await this.findOne(companyId, id);
    if (dto.assignedDriverId) {
      await this.assertDriverBelongsToCompany(companyId, dto.assignedDriverId);
    }
    return this.prisma.vehicle.update({
      where: { id },
      data: {
        registrationNumber: dto.registrationNumber,
        make: dto.make,
        model: dto.model,
        year: dto.year,
        odometerReading: dto.odometerReading,
        fuelType: dto.fuelType,
        assignedDriverId: dto.assignedDriverId,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        note: dto.note,
      },
      include: vehicleInclude,
    });
  }

  async retire(companyId: string, id: string) {
    const vehicle = await this.findOne(companyId, id);
    if (vehicle.status === "RETIRED") {
      throw new BadRequestException("This vehicle is already retired");
    }
    if (vehicle.status === "IN_MAINTENANCE") {
      throw new BadRequestException("A vehicle in maintenance cannot be retired");
    }
    return this.prisma.vehicle.update({ where: { id }, data: { status: "RETIRED" }, include: vehicleInclude });
  }

  async reactivate(companyId: string, id: string) {
    const vehicle = await this.findOne(companyId, id);
    if (vehicle.status !== "RETIRED") {
      throw new BadRequestException("Only a retired vehicle can be reactivated");
    }
    return this.prisma.vehicle.update({ where: { id }, data: { status: "ACTIVE" }, include: vehicleInclude });
  }

  async remove(companyId: string, id: string): Promise<void> {
    const vehicle = await this.findOne(companyId, id);
    if (vehicle.status !== "RETIRED") {
      throw new ForbiddenException("Only a retired vehicle can be deleted");
    }
    await this.prisma.vehicle.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(companyId: string, query: Pick<ListVehiclesQueryDto, "search" | "status">): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.vehicle.findMany({
      where,
      include: vehicleInclude,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      registrationNumber: r.registrationNumber,
      make: r.make,
      model: r.model,
      year: r.year ?? "",
      status: r.status,
      odometerReading: r.odometerReading,
      assignedDriver: r.assignedDriver ? `${r.assignedDriver.firstName} ${r.assignedDriver.lastName}` : "",
    }));
    return toCsv(flat, ["registrationNumber", "make", "model", "year", "status", "odometerReading", "assignedDriver"]);
  }
}

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import type { Prisma, ShipmentStatus } from "@omniflow/database";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import { priceLineItems, type PricedLineItem } from "../../sales/common/line-item.dto";
import { formatDocumentNumber } from "../../sales/common/document-number.util";
import type { CreateShipmentDto } from "./dto/create-shipment.dto";
import type { DispatchShipmentDto } from "./dto/dispatch-shipment.dto";
import type { FailShipmentDto } from "./dto/fail-shipment.dto";
import type { ListShipmentsQueryDto } from "./dto/list-shipments-query.dto";
import type { TrackShipmentDto } from "./dto/track-shipment.dto";
import type { UpdateShipmentDto } from "./dto/update-shipment.dto";

const EXPORT_ROW_LIMIT = 5000;

const shipmentInclude = {
  warehouse: { select: { id: true, name: true, code: true } },
  account: { select: { id: true, name: true } },
  salesOrder: { select: { id: true, orderNumber: true } },
  vehicle: { select: { id: true, registrationNumber: true, make: true, model: true } },
  driver: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
  trip: { select: { id: true, status: true, startOdometer: true } },
  events: { orderBy: { occurredAt: "asc" } },
} as const;

@Injectable()
export class ShipmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(
    companyId: string,
    query: Pick<ListShipmentsQueryDto, "search" | "status" | "warehouseId" | "vehicleId">,
  ) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { shipmentNumber: { contains: query.search, mode: "insensitive" as const } },
              { destinationAddress: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
    };
  }

  async list(companyId: string, query: ListShipmentsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        include: shipmentInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.shipment.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id, companyId, deletedAt: null },
      include: shipmentInclude,
    });
    if (!shipment) {
      throw new NotFoundException("Shipment not found");
    }
    return shipment;
  }

  /**
   * Validates whichever cross-module references are present belong to this
   * company. Every field is optional here because the same check serves
   * create (where the warehouse is required), update, and dispatch (which
   * only ever carries a vehicle and driver).
   */
  private async assertReferencesBelongToCompany(
    companyId: string,
    dto: {
      warehouseId?: string;
      salesOrderId?: string;
      accountId?: string;
      vehicleId?: string;
      driverId?: string;
    },
  ): Promise<void> {
    if (dto.warehouseId) {
      const count = await this.prisma.warehouse.count({
        where: { id: dto.warehouseId, companyId, deletedAt: null },
      });
      if (count === 0) throw new BadRequestException("Warehouse does not belong to this company");
    }
    if (dto.salesOrderId) {
      const count = await this.prisma.salesOrder.count({
        where: { id: dto.salesOrderId, companyId, deletedAt: null },
      });
      if (count === 0) throw new BadRequestException("Sales order does not belong to this company");
    }
    if (dto.accountId) {
      const count = await this.prisma.crmAccount.count({
        where: { id: dto.accountId, companyId, deletedAt: null },
      });
      if (count === 0) throw new BadRequestException("Account does not belong to this company");
    }
    if (dto.vehicleId) {
      const count = await this.prisma.vehicle.count({
        where: { id: dto.vehicleId, companyId, deletedAt: null },
      });
      if (count === 0) throw new BadRequestException("Vehicle does not belong to this company");
    }
    if (dto.driverId) {
      const count = await this.prisma.employee.count({
        where: { id: dto.driverId, companyId, deletedAt: null },
      });
      if (count === 0) throw new BadRequestException("Driver does not belong to this company");
    }
  }

  async create(companyId: string, dto: CreateShipmentDto) {
    await this.assertReferencesBelongToCompany(companyId, dto);
    const { items } = priceLineItems(dto.items);

    return this.prisma.$transaction(async (tx) => {
      const count = await tx.shipment.count({ where: { companyId } });
      const shipmentNumber = formatDocumentNumber("SHP", count);

      const shipment = await tx.shipment.create({
        data: {
          companyId,
          shipmentNumber,
          warehouseId: dto.warehouseId,
          salesOrderId: dto.salesOrderId,
          accountId: dto.accountId,
          vehicleId: dto.vehicleId,
          driverId: dto.driverId,
          items: items as unknown as object,
          destinationAddress: dto.destinationAddress,
          contactName: dto.contactName,
          contactPhone: dto.contactPhone,
          scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : undefined,
          note: dto.note,
        },
      });

      await this.appendEvent(tx, companyId, shipment.id, "DRAFT", undefined, "Shipment created");

      return tx.shipment.findUniqueOrThrow({ where: { id: shipment.id }, include: shipmentInclude });
    });
  }

  async update(companyId: string, id: string, dto: UpdateShipmentDto) {
    const shipment = await this.findOne(companyId, id);
    if (shipment.status !== "DRAFT") {
      throw new BadRequestException("Only a draft shipment can be edited");
    }
    await this.assertReferencesBelongToCompany(companyId, dto);

    const items = dto.items ? priceLineItems(dto.items).items : undefined;

    return this.prisma.shipment.update({
      where: { id },
      data: {
        warehouseId: dto.warehouseId,
        salesOrderId: dto.salesOrderId,
        accountId: dto.accountId,
        vehicleId: dto.vehicleId,
        driverId: dto.driverId,
        ...(items ? { items: items as unknown as object } : {}),
        destinationAddress: dto.destinationAddress,
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : undefined,
        note: dto.note,
      },
      include: shipmentInclude,
    });
  }

  /** Appends one entry to the shipment's tracking timeline. */
  private async appendEvent(
    tx: Prisma.TransactionClient,
    companyId: string,
    shipmentId: string,
    status: ShipmentStatus,
    location: string | undefined,
    note: string | undefined,
    userId?: string,
  ): Promise<void> {
    await tx.deliveryEvent.create({
      data: { companyId, shipmentId, status, location, note, createdById: userId },
    });
  }

  /**
   * DRAFT -> DISPATCHED. The pivotal action: it deducts each line item's
   * stock at the origin warehouse using the same SALE StockMovementType and
   * "Insufficient stock" guard POS sales and Manufacturing work orders use,
   * and — when a vehicle is assigned — opens a Fleet Trip through a direct
   * `tx.trip.create`, the same cross-module-write-inside-a-transaction
   * convention Purchase's receive() established.
   */
  async dispatch(companyId: string, userId: string, id: string, dto: DispatchShipmentDto) {
    const shipment = await this.findOne(companyId, id);
    if (shipment.status !== "DRAFT") {
      throw new BadRequestException("Only a draft shipment can be dispatched");
    }
    await this.assertReferencesBelongToCompany(companyId, dto);

    const vehicleId = dto.vehicleId ?? shipment.vehicleId ?? undefined;
    let vehicle = null;
    if (vehicleId) {
      vehicle = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, companyId, deletedAt: null } });
      if (!vehicle) {
        throw new BadRequestException("Vehicle does not belong to this company");
      }
      if (vehicle.status !== "ACTIVE") {
        throw new BadRequestException(`A vehicle that is ${vehicle.status.toLowerCase()} cannot carry a shipment`);
      }
    }
    const driverId = dto.driverId ?? shipment.driverId ?? vehicle?.assignedDriverId ?? undefined;

    const items = shipment.items as unknown as PricedLineItem[];
    const productIds = Array.from(new Set(items.filter((i) => i.productId).map((i) => i.productId as string)));
    let skuById = new Map<string, string>();
    if (productIds.length > 0) {
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds }, companyId, deletedAt: null },
        select: { id: true, sku: true },
      });
      if (products.length !== productIds.length) {
        throw new BadRequestException("One or more products do not belong to this company");
      }
      skuById = new Map(products.map((p) => [p.id, p.sku]));
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (!item.productId) continue;
        const stockItem = await tx.stockItem.upsert({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: shipment.warehouseId } },
          create: { companyId, productId: item.productId, warehouseId: shipment.warehouseId, quantityOnHand: 0 },
          update: {},
        });
        const newQuantity = stockItem.quantityOnHand - item.quantity;
        if (newQuantity < 0) {
          throw new BadRequestException(
            `Insufficient stock for ${skuById.get(item.productId)}: ${stockItem.quantityOnHand} on hand, cannot ship ${item.quantity}`,
          );
        }
        await tx.stockItem.update({ where: { id: stockItem.id }, data: { quantityOnHand: newQuantity } });
        await tx.stockMovement.create({
          data: {
            companyId,
            productId: item.productId,
            warehouseId: shipment.warehouseId,
            type: "SALE",
            quantity: -item.quantity,
            reference: shipment.shipmentNumber,
            note: `Dispatched on shipment ${shipment.shipmentNumber}`,
            createdById: userId,
          },
        });
      }

      // Opening the trip is Logistics writing into Fleet's table directly —
      // never by injecting Fleet's service — so the whole dispatch stays one
      // transaction. Closing it stays Fleet's job: completing a trip needs a
      // real end-odometer reading only Fleet can supply.
      let tripId: string | undefined;
      if (vehicle) {
        const trip = await tx.trip.create({
          data: {
            companyId,
            vehicleId: vehicle.id,
            driverId,
            purpose: `Delivery ${shipment.shipmentNumber}`,
            startOdometer: vehicle.odometerReading,
          },
        });
        tripId = trip.id;
      }

      await tx.shipment.update({
        where: { id },
        data: {
          status: "DISPATCHED",
          dispatchedAt: new Date(),
          vehicleId: vehicle?.id ?? null,
          driverId: driverId ?? null,
          tripId,
        },
      });

      await this.appendEvent(tx, companyId, id, "DISPATCHED", undefined, dto.note ?? "Dispatched", userId);

      return tx.shipment.findUniqueOrThrow({ where: { id }, include: shipmentInclude });
    });
  }

  /** DISPATCHED -> IN_TRANSIT. Pure tracking: records where the goods are. */
  async markInTransit(companyId: string, userId: string, id: string, dto: TrackShipmentDto) {
    const shipment = await this.findOne(companyId, id);
    if (shipment.status !== "DISPATCHED") {
      throw new BadRequestException("Only a dispatched shipment can be marked in transit");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.shipment.update({ where: { id }, data: { status: "IN_TRANSIT" } });
      await this.appendEvent(tx, companyId, id, "IN_TRANSIT", dto.location, dto.note ?? "In transit", userId);
      return tx.shipment.findUniqueOrThrow({ where: { id }, include: shipmentInclude });
    });
  }

  /** DISPATCHED or IN_TRANSIT -> DELIVERED. Stock already left on dispatch. */
  async deliver(companyId: string, userId: string, id: string, dto: TrackShipmentDto) {
    const shipment = await this.findOne(companyId, id);
    if (shipment.status !== "DISPATCHED" && shipment.status !== "IN_TRANSIT") {
      throw new BadRequestException("Only a dispatched or in-transit shipment can be delivered");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.shipment.update({ where: { id }, data: { status: "DELIVERED", deliveredAt: new Date() } });
      await this.appendEvent(tx, companyId, id, "DELIVERED", dto.location, dto.note ?? "Delivered", userId);
      return tx.shipment.findUniqueOrThrow({ where: { id }, include: shipmentInclude });
    });
  }

  /**
   * DISPATCHED or IN_TRANSIT -> FAILED. The goods come back, so the stock
   * deducted at dispatch is returned using the existing RETURN movement
   * type — the same restock shape POS uses for a void or refund.
   */
  async fail(companyId: string, userId: string, id: string, dto: FailShipmentDto) {
    const shipment = await this.findOne(companyId, id);
    if (shipment.status !== "DISPATCHED" && shipment.status !== "IN_TRANSIT") {
      throw new BadRequestException("Only a dispatched or in-transit shipment can be marked failed");
    }

    const items = shipment.items as unknown as PricedLineItem[];

    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (!item.productId) continue;
        const stockItem = await tx.stockItem.upsert({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: shipment.warehouseId } },
          create: { companyId, productId: item.productId, warehouseId: shipment.warehouseId, quantityOnHand: 0 },
          update: {},
        });
        await tx.stockItem.update({
          where: { id: stockItem.id },
          data: { quantityOnHand: stockItem.quantityOnHand + item.quantity },
        });
        await tx.stockMovement.create({
          data: {
            companyId,
            productId: item.productId,
            warehouseId: shipment.warehouseId,
            type: "RETURN",
            quantity: item.quantity,
            reference: shipment.shipmentNumber,
            note: `Returned from failed shipment ${shipment.shipmentNumber}`,
            createdById: userId,
          },
        });
      }

      await tx.shipment.update({ where: { id }, data: { status: "FAILED", failureReason: dto.failureReason } });
      await this.appendEvent(tx, companyId, id, "FAILED", dto.location, dto.failureReason, userId);

      return tx.shipment.findUniqueOrThrow({ where: { id }, include: shipmentInclude });
    });
  }

  /** Only a draft shipment can be cancelled — nothing has moved yet. */
  async cancel(companyId: string, userId: string, id: string) {
    const shipment = await this.findOne(companyId, id);
    if (shipment.status !== "DRAFT") {
      throw new BadRequestException("Only a draft shipment can be cancelled");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.shipment.update({ where: { id }, data: { status: "CANCELLED" } });
      await this.appendEvent(tx, companyId, id, "CANCELLED", undefined, "Cancelled", userId);
      return tx.shipment.findUniqueOrThrow({ where: { id }, include: shipmentInclude });
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    const shipment = await this.findOne(companyId, id);
    if (shipment.status !== "DRAFT" && shipment.status !== "CANCELLED") {
      throw new ForbiddenException("Only a draft or cancelled shipment can be deleted");
    }
    await this.prisma.shipment.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListShipmentsQueryDto, "search" | "status" | "warehouseId" | "vehicleId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.shipment.findMany({
      where,
      include: shipmentInclude,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      shipmentNumber: r.shipmentNumber,
      status: r.status,
      warehouse: r.warehouse.name,
      account: r.account?.name ?? "",
      destinationAddress: r.destinationAddress,
      vehicle: r.vehicle?.registrationNumber ?? "",
      driver: r.driver ? `${r.driver.firstName} ${r.driver.lastName}` : "",
      dispatchedAt: r.dispatchedAt ?? "",
      deliveredAt: r.deliveredAt ?? "",
    }));
    return toCsv(flat, [
      "shipmentNumber",
      "status",
      "warehouse",
      "account",
      "destinationAddress",
      "vehicle",
      "driver",
      "dispatchedAt",
      "deliveredAt",
    ]);
  }
}

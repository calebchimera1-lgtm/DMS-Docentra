import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import { formatDocumentNumber } from "../../sales/common/document-number.util";
import type { CreateWorkOrderDto } from "./dto/create-work-order.dto";
import type { ListWorkOrdersQueryDto } from "./dto/list-work-orders-query.dto";
import type { UpdateWorkOrderDto } from "./dto/update-work-order.dto";

const EXPORT_ROW_LIMIT = 5000;

const workOrderInclude = {
  bom: { select: { id: true, name: true } },
  product: { select: { id: true, sku: true, name: true } },
  warehouse: { select: { id: true, name: true, code: true } },
} as const;

@Injectable()
export class WorkOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(
    companyId: string,
    query: Pick<ListWorkOrdersQueryDto, "search" | "status" | "bomId" | "warehouseId">,
  ) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search
        ? { workOrderNumber: { contains: query.search, mode: "insensitive" as const } }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.bomId ? { bomId: query.bomId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    };
  }

  private async assertWarehouseBelongsToCompany(companyId: string, warehouseId: string): Promise<void> {
    const count = await this.prisma.warehouse.count({ where: { id: warehouseId, companyId, deletedAt: null } });
    if (count === 0) {
      throw new BadRequestException("Warehouse does not belong to this company");
    }
  }

  private async findBom(companyId: string, bomId: string) {
    const bom = await this.prisma.billOfMaterial.findFirst({
      where: { id: bomId, companyId, deletedAt: null },
      include: { lines: { include: { componentProduct: { select: { id: true, sku: true, name: true } } } } },
    });
    if (!bom) {
      throw new BadRequestException("Bill of material does not belong to this company");
    }
    return bom;
  }

  async list(companyId: string, query: ListWorkOrdersQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.workOrder.findMany({
        where,
        include: workOrderInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.workOrder.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: workOrderInclude,
    });
    if (!workOrder) {
      throw new NotFoundException("Work order not found");
    }
    return workOrder;
  }

  async create(companyId: string, userId: string, dto: CreateWorkOrderDto) {
    const bom = await this.findBom(companyId, dto.bomId);
    await this.assertWarehouseBelongsToCompany(companyId, dto.warehouseId);

    const count = await this.prisma.workOrder.count({ where: { companyId } });
    return this.prisma.workOrder.create({
      data: {
        companyId,
        workOrderNumber: formatDocumentNumber("WO", count),
        bomId: bom.id,
        productId: bom.productId,
        warehouseId: dto.warehouseId,
        quantity: dto.quantity,
        plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : undefined,
        note: dto.note,
        createdById: userId,
      },
      include: workOrderInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdateWorkOrderDto) {
    const existing = await this.findOne(companyId, id);
    if (existing.status !== "DRAFT") {
      throw new BadRequestException("Only a draft work order can be edited");
    }
    let productId: string | undefined;
    if (dto.bomId) {
      const bom = await this.findBom(companyId, dto.bomId);
      productId = bom.productId;
    }
    if (dto.warehouseId) {
      await this.assertWarehouseBelongsToCompany(companyId, dto.warehouseId);
    }

    return this.prisma.workOrder.update({
      where: { id },
      data: {
        bomId: dto.bomId,
        productId,
        warehouseId: dto.warehouseId,
        quantity: dto.quantity,
        plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : undefined,
        note: dto.note,
      },
      include: workOrderInclude,
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    const existing = await this.findOne(companyId, id);
    if (existing.status !== "DRAFT") {
      throw new ForbiddenException("Only a draft work order can be deleted");
    }
    await this.prisma.workOrder.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * Starting is a dedicated action with a real side effect: it
   * transactionally consumes each BOM line's component stock (that line's
   * quantity times this work order's own quantity) at the work order's
   * warehouse, reusing the same "Insufficient stock" guard Inventory's own
   * manual movements use.
   */
  async start(companyId: string, userId: string, id: string) {
    const workOrder = await this.findOne(companyId, id);
    if (workOrder.status !== "DRAFT") {
      throw new BadRequestException("Only a draft work order can be started");
    }
    const bom = await this.findBom(companyId, workOrder.bomId);

    return this.prisma.$transaction(async (tx) => {
      for (const line of bom.lines) {
        const requiredQty = line.quantity * workOrder.quantity;
        const stockItem = await tx.stockItem.upsert({
          where: {
            productId_warehouseId: { productId: line.componentProductId, warehouseId: workOrder.warehouseId },
          },
          create: {
            companyId,
            productId: line.componentProductId,
            warehouseId: workOrder.warehouseId,
            quantityOnHand: 0,
          },
          update: {},
        });
        const newQuantity = stockItem.quantityOnHand - requiredQty;
        if (newQuantity < 0) {
          throw new BadRequestException(
            `Insufficient stock for ${line.componentProduct.sku}: ${stockItem.quantityOnHand} on hand, need ${requiredQty}`,
          );
        }
        await tx.stockItem.update({ where: { id: stockItem.id }, data: { quantityOnHand: newQuantity } });
        await tx.stockMovement.create({
          data: {
            companyId,
            productId: line.componentProductId,
            warehouseId: workOrder.warehouseId,
            type: "PRODUCTION_CONSUME",
            quantity: -requiredQty,
            reference: workOrder.workOrderNumber,
            note: `Consumed for work order ${workOrder.workOrderNumber}`,
            createdById: userId,
          },
        });
      }

      return tx.workOrder.update({
        where: { id },
        data: { status: "IN_PROGRESS", startedAt: new Date() },
        include: workOrderInclude,
      });
    });
  }

  /**
   * Completing is the counterpart dedicated action: it posts the finished
   * product's yield (this work order's quantity) into the same warehouse,
   * transactionally, the same "reuse Inventory's own movement-recording
   * logic" convention Purchase's `receive()` established.
   */
  async complete(companyId: string, userId: string, id: string) {
    const workOrder = await this.findOne(companyId, id);
    if (workOrder.status !== "IN_PROGRESS") {
      throw new BadRequestException("Only an in-progress work order can be completed");
    }

    return this.prisma.$transaction(async (tx) => {
      const stockItem = await tx.stockItem.upsert({
        where: { productId_warehouseId: { productId: workOrder.productId, warehouseId: workOrder.warehouseId } },
        create: {
          companyId,
          productId: workOrder.productId,
          warehouseId: workOrder.warehouseId,
          quantityOnHand: 0,
        },
        update: {},
      });
      await tx.stockItem.update({
        where: { id: stockItem.id },
        data: { quantityOnHand: stockItem.quantityOnHand + workOrder.quantity },
      });
      await tx.stockMovement.create({
        data: {
          companyId,
          productId: workOrder.productId,
          warehouseId: workOrder.warehouseId,
          type: "PRODUCTION_YIELD",
          quantity: workOrder.quantity,
          reference: workOrder.workOrderNumber,
          note: `Yield from work order ${workOrder.workOrderNumber}`,
          createdById: userId,
        },
      });

      return tx.workOrder.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: new Date() },
        include: workOrderInclude,
      });
    });
  }

  async cancel(companyId: string, id: string) {
    const workOrder = await this.findOne(companyId, id);
    if (workOrder.status !== "DRAFT") {
      throw new BadRequestException("Only a draft work order can be cancelled");
    }
    return this.prisma.workOrder.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: workOrderInclude,
    });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListWorkOrdersQueryDto, "search" | "status" | "bomId" | "warehouseId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.workOrder.findMany({
      where,
      include: workOrderInclude,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      workOrderNumber: r.workOrderNumber,
      bom: r.bom.name,
      product: r.product.sku,
      warehouse: r.warehouse.name,
      quantity: r.quantity,
      status: r.status,
      plannedDate: r.plannedDate ?? "",
    }));
    return toCsv(flat, ["workOrderNumber", "bom", "product", "warehouse", "quantity", "status", "plannedDate"]);
  }
}

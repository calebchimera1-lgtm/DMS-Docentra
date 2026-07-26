import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import { formatDocumentNumber } from "../../sales/common/document-number.util";
import type { CloseSessionDto } from "./dto/close-session.dto";
import type { ListSessionsQueryDto } from "./dto/list-sessions-query.dto";
import type { OpenSessionDto } from "./dto/open-session.dto";

const EXPORT_ROW_LIMIT = 5000;

const sessionInclude = {
  warehouse: { select: { id: true, name: true, code: true } },
  openedBy: { select: { id: true, firstName: true, lastName: true } },
  closedBy: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { sales: true } },
} as const;

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListSessionsQueryDto, "status" | "warehouseId">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    };
  }

  async list(companyId: string, query: ListSessionsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.posRegisterSession.findMany({
        where,
        include: sessionInclude,
        orderBy: { openedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.posRegisterSession.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const session = await this.prisma.posRegisterSession.findFirst({
      where: { id, companyId, deletedAt: null },
      include: sessionInclude,
    });
    if (!session) {
      throw new NotFoundException("Register session not found");
    }
    return session;
  }

  async open(companyId: string, userId: string, dto: OpenSessionDto) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, companyId, deletedAt: null },
    });
    if (!warehouse) {
      throw new BadRequestException("Warehouse does not belong to this company");
    }
    const alreadyOpen = await this.prisma.posRegisterSession.count({
      where: { companyId, warehouseId: dto.warehouseId, status: "OPEN", deletedAt: null },
    });
    if (alreadyOpen > 0) {
      throw new BadRequestException("This warehouse already has an open register session");
    }

    const count = await this.prisma.posRegisterSession.count({ where: { companyId } });
    return this.prisma.posRegisterSession.create({
      data: {
        companyId,
        sessionNumber: formatDocumentNumber("REG", count),
        warehouseId: dto.warehouseId,
        openingFloatCents: dto.openingFloatCents ?? 0,
        openedById: userId,
        note: dto.note,
      },
      include: sessionInclude,
    });
  }

  /**
   * Closing counts the drawer and reconciles it against expected cash
   * (opening float plus every still-COMPLETED cash sale in this session —
   * a sale that was voided or refunded no longer counts, since the cash
   * that came in when it was rung up was handed back out).
   */
  async close(companyId: string, userId: string, id: string, dto: CloseSessionDto) {
    const session = await this.findOne(companyId, id);
    if (session.status !== "OPEN") {
      throw new BadRequestException("Only an open register session can be closed");
    }

    const cashAgg = await this.prisma.posSale.aggregate({
      where: { companyId, sessionId: id, status: "COMPLETED", paymentMethod: "CASH" },
      _sum: { totalCents: true },
    });
    const expectedCashCents = session.openingFloatCents + (cashAgg._sum.totalCents ?? 0);
    const cashDifferenceCents = dto.countedCashCents - expectedCashCents;

    return this.prisma.posRegisterSession.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedById: userId,
        closedAt: new Date(),
        expectedCashCents,
        countedCashCents: dto.countedCashCents,
        cashDifferenceCents,
      },
      include: sessionInclude,
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    const session = await this.findOne(companyId, id);
    if (session.status !== "OPEN") {
      throw new ForbiddenException("Only an open register session can be deleted");
    }
    if (session._count.sales > 0) {
      throw new ForbiddenException("A register session with sales recorded against it cannot be deleted");
    }
    await this.prisma.posRegisterSession.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(companyId: string, query: Pick<ListSessionsQueryDto, "status" | "warehouseId">): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.posRegisterSession.findMany({
      where,
      include: sessionInclude,
      orderBy: { openedAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      sessionNumber: r.sessionNumber,
      warehouse: r.warehouse.name,
      status: r.status,
      openingFloatCents: r.openingFloatCents,
      expectedCashCents: r.expectedCashCents ?? "",
      countedCashCents: r.countedCashCents ?? "",
      cashDifferenceCents: r.cashDifferenceCents ?? "",
      openedAt: r.openedAt,
    }));
    return toCsv(flat, [
      "sessionNumber",
      "warehouse",
      "status",
      "openingFloatCents",
      "expectedCashCents",
      "countedCashCents",
      "cashDifferenceCents",
      "openedAt",
    ]);
  }
}

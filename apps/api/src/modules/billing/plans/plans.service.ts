import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreatePlanDto } from "./dto/create-plan.dto";
import type { ListPlansQueryDto } from "./dto/list-plans-query.dto";
import type { UpdatePlanDto } from "./dto/update-plan.dto";

const EXPORT_ROW_LIMIT = 5000;

const planInclude = {
  _count: { select: { subscriptions: true } },
} as const;

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListPlansQueryDto, "search" | "billingInterval" | "isActive">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: "insensitive" as const } },
              { name: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.billingInterval ? { billingInterval: query.billingInterval } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };
  }

  async list(companyId: string, query: ListPlansQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.subscriptionPlan.findMany({
        where,
        include: planInclude,
        orderBy: { code: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.subscriptionPlan.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { id, companyId, deletedAt: null },
      include: planInclude,
    });
    if (!plan) {
      throw new NotFoundException("Plan not found");
    }
    return plan;
  }

  async create(companyId: string, dto: CreatePlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: {
        companyId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        priceCents: dto.priceCents,
        currency: dto.currency ?? "USD",
        billingInterval: dto.billingInterval ?? "MONTHLY",
        trialDays: dto.trialDays ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: planInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdatePlanDto) {
    await this.findOne(companyId, id);
    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        priceCents: dto.priceCents,
        currency: dto.currency,
        billingInterval: dto.billingInterval,
        trialDays: dto.trialDays,
        isActive: dto.isActive,
      },
      include: planInclude,
    });
  }

  /**
   * A plan with subscriptions attached is never deleted — the price and
   * interval on it are what every past invoice was calculated from, so
   * removing it would strand that history. Deactivate instead.
   */
  async remove(companyId: string, id: string): Promise<void> {
    const plan = await this.findOne(companyId, id);
    if (plan._count.subscriptions > 0) {
      throw new ForbiddenException("This plan still has subscriptions; deactivate it instead");
    }
    await this.prisma.subscriptionPlan.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListPlansQueryDto, "search" | "billingInterval" | "isActive">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.subscriptionPlan.findMany({
      where,
      include: planInclude,
      orderBy: { code: "asc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      code: r.code,
      name: r.name,
      priceCents: r.priceCents,
      currency: r.currency,
      billingInterval: r.billingInterval,
      trialDays: r.trialDays,
      isActive: r.isActive,
      subscriptions: r._count.subscriptions,
    }));
    return toCsv(flat, [
      "code",
      "name",
      "priceCents",
      "currency",
      "billingInterval",
      "trialDays",
      "isActive",
      "subscriptions",
    ]);
  }
}

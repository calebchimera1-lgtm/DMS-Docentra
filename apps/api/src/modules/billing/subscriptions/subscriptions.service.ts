import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import { formatDocumentNumber } from "../../sales/common/document-number.util";
import { addDays, addInterval } from "../common/billing-period.util";
import type { BillSubscriptionDto } from "./dto/bill-subscription.dto";
import type { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import type { ListSubscriptionsQueryDto } from "./dto/list-subscriptions-query.dto";
import type { UpdateSubscriptionDto } from "./dto/update-subscription.dto";

const EXPORT_ROW_LIMIT = 5000;

const subscriptionInclude = {
  account: { select: { id: true, name: true } },
  plan: {
    select: { id: true, code: true, name: true, priceCents: true, currency: true, billingInterval: true },
  },
  invoices: {
    orderBy: { periodStart: "desc" },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      amountCents: true,
      createdAt: true,
      invoice: { select: { id: true, invoiceNumber: true, status: true, totalCents: true } },
    },
  },
} as const;

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListSubscriptionsQueryDto, "status" | "accountId" | "planId">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.planId ? { planId: query.planId } : {}),
    };
  }

  async list(companyId: string, query: ListSubscriptionsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        include: subscriptionInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id, companyId, deletedAt: null },
      include: subscriptionInclude,
    });
    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }
    return subscription;
  }

  /**
   * Opens a subscription. The first period runs from the start date to one
   * interval later, and a plan with a trial starts TRIALING rather than
   * ACTIVE — billing is refused until the trial is converted, so a trial
   * cannot be invoiced by accident.
   */
  async create(companyId: string, dto: CreateSubscriptionDto) {
    const [accountCount, plan] = await Promise.all([
      this.prisma.crmAccount.count({ where: { id: dto.accountId, companyId, deletedAt: null } }),
      this.prisma.subscriptionPlan.findFirst({ where: { id: dto.planId, companyId, deletedAt: null } }),
    ]);
    if (accountCount === 0) {
      throw new BadRequestException("Account does not belong to this company");
    }
    if (!plan) {
      throw new BadRequestException("Plan does not belong to this company");
    }
    if (!plan.isActive) {
      throw new BadRequestException("This plan is inactive and cannot take new subscriptions");
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const trialing = plan.trialDays > 0;

    return this.prisma.subscription.create({
      data: {
        companyId,
        accountId: dto.accountId,
        planId: plan.id,
        quantity: dto.quantity ?? 1,
        status: trialing ? "TRIALING" : "ACTIVE",
        startDate,
        currentPeriodStart: startDate,
        currentPeriodEnd: addInterval(startDate, plan.billingInterval),
        trialEndsAt: trialing ? addDays(startDate, plan.trialDays) : undefined,
        note: dto.note,
      },
      include: subscriptionInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdateSubscriptionDto) {
    const subscription = await this.findOne(companyId, id);
    if (subscription.status === "CANCELLED") {
      throw new BadRequestException("A cancelled subscription cannot be edited");
    }
    return this.prisma.subscription.update({
      where: { id },
      data: { quantity: dto.quantity, note: dto.note },
      include: subscriptionInclude,
    });
  }

  /** Converts a trial to a paying subscription. */
  async activate(companyId: string, id: string) {
    const subscription = await this.findOne(companyId, id);
    if (subscription.status !== "TRIALING") {
      throw new BadRequestException("Only a trialing subscription can be activated");
    }
    return this.prisma.subscription.update({
      where: { id },
      data: { status: "ACTIVE", trialEndsAt: null },
      include: subscriptionInclude,
    });
  }

  /**
   * Bills the current period and rolls the subscription forward.
   *
   * In one transaction this raises a real Sales invoice — writing into the
   * Invoice table directly rather than injecting the Sales service, the
   * same cross-module convention Purchase's receive() established — links
   * it to the period through a SubscriptionInvoice row, and advances
   * `currentPeriodStart`/`End` by exactly one interval so periods tile
   * forward with no gap.
   *
   * Charging twice for the same period is prevented by the unique key on
   * (subscriptionId, periodStart): the pre-check gives a clear 409, and
   * the constraint is what actually guarantees it under concurrent calls.
   */
  async bill(companyId: string, userId: string, id: string, dto: BillSubscriptionDto) {
    const subscription = await this.findOne(companyId, id);
    if (subscription.status !== "ACTIVE") {
      throw new BadRequestException(
        subscription.status === "TRIALING"
          ? "Activate the trial before billing it"
          : `A ${subscription.status.toLowerCase()} subscription cannot be billed`,
      );
    }

    const periodStart = subscription.currentPeriodStart;
    const periodEnd = subscription.currentPeriodEnd;

    const alreadyBilled = await this.prisma.subscriptionInvoice.count({
      where: { subscriptionId: id, periodStart },
    });
    if (alreadyBilled > 0) {
      throw new ConflictException("This period has already been invoiced");
    }

    const amountCents = subscription.plan.priceCents * subscription.quantity;

    return this.prisma.$transaction(async (tx) => {
      const invoiceCount = await tx.invoice.count({ where: { companyId } });
      const invoiceNumber = formatDocumentNumber("INV", invoiceCount);

      const invoice = await tx.invoice.create({
        data: {
          companyId,
          accountId: subscription.accountId,
          invoiceNumber,
          status: "SENT",
          items: [
            {
              description: `${subscription.plan.name} (${periodStart.toISOString().slice(0, 10)} – ${periodEnd
                .toISOString()
                .slice(0, 10)})`,
              quantity: subscription.quantity,
              unitPriceCents: subscription.plan.priceCents,
              totalCents: amountCents,
            },
          ] as unknown as object,
          totalCents: amountCents,
          currency: subscription.plan.currency,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : periodEnd,
          ownerId: userId,
        },
      });

      await tx.subscriptionInvoice.create({
        data: {
          companyId,
          subscriptionId: id,
          invoiceId: invoice.id,
          periodStart,
          periodEnd,
          amountCents,
        },
      });

      await tx.subscription.update({
        where: { id },
        data: {
          currentPeriodStart: periodEnd,
          currentPeriodEnd: addInterval(periodEnd, subscription.plan.billingInterval),
        },
      });

      return tx.subscription.findUniqueOrThrow({ where: { id }, include: subscriptionInclude });
    });
  }

  async pause(companyId: string, id: string) {
    const subscription = await this.findOne(companyId, id);
    if (subscription.status !== "ACTIVE") {
      throw new BadRequestException("Only an active subscription can be paused");
    }
    return this.prisma.subscription.update({ where: { id }, data: { status: "PAUSED" }, include: subscriptionInclude });
  }

  async resume(companyId: string, id: string) {
    const subscription = await this.findOne(companyId, id);
    if (subscription.status !== "PAUSED") {
      throw new BadRequestException("Only a paused subscription can be resumed");
    }
    return this.prisma.subscription.update({ where: { id }, data: { status: "ACTIVE" }, include: subscriptionInclude });
  }

  async cancel(companyId: string, id: string) {
    const subscription = await this.findOne(companyId, id);
    if (subscription.status === "CANCELLED") {
      throw new BadRequestException("This subscription is already cancelled");
    }
    return this.prisma.subscription.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
      include: subscriptionInclude,
    });
  }

  /**
   * Only a subscription that never billed anything can be removed —
   * anything else is referenced by invoices the customer has received.
   */
  async remove(companyId: string, id: string): Promise<void> {
    const subscription = await this.findOne(companyId, id);
    if (subscription.invoices.length > 0) {
      throw new ForbiddenException("This subscription has billing history; cancel it instead");
    }
    await this.prisma.subscription.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListSubscriptionsQueryDto, "status" | "accountId" | "planId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.subscription.findMany({
      where,
      include: subscriptionInclude,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      account: r.account.name,
      plan: r.plan.code,
      status: r.status,
      quantity: r.quantity,
      billingInterval: r.plan.billingInterval,
      priceCents: r.plan.priceCents,
      currentPeriodStart: r.currentPeriodStart,
      currentPeriodEnd: r.currentPeriodEnd,
      invoicesRaised: r.invoices.length,
    }));
    return toCsv(flat, [
      "account",
      "plan",
      "status",
      "quantity",
      "billingInterval",
      "priceCents",
      "currentPeriodStart",
      "currentPeriodEnd",
      "invoicesRaised",
    ]);
  }
}

import { Injectable } from "@nestjs/common";
import type { PaymentMethod } from "@omniflow/database";
import { PrismaService } from "../../../prisma/prisma.service";

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "BANK_TRANSFER", "CARD", "OTHER"];

@Injectable()
export class PosReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(companyId: string) {
    const [openSessionCount, completedSaleCount, voidedCount, refundedCount, completedAgg] = await Promise.all([
      this.prisma.posRegisterSession.count({ where: { companyId, deletedAt: null, status: "OPEN" } }),
      this.prisma.posSale.count({ where: { companyId, deletedAt: null, status: "COMPLETED" } }),
      this.prisma.posSale.count({ where: { companyId, deletedAt: null, status: "VOIDED" } }),
      this.prisma.posSale.count({ where: { companyId, deletedAt: null, status: "REFUNDED" } }),
      this.prisma.posSale.aggregate({
        where: { companyId, deletedAt: null, status: "COMPLETED" },
        _sum: { totalCents: true },
      }),
    ]);

    return {
      openSessionCount,
      completedSaleCount,
      voidedCount,
      refundedCount,
      totalSalesValueCents: completedAgg._sum.totalCents ?? 0,
    };
  }

  async byPaymentMethod(companyId: string) {
    const grouped = await this.prisma.posSale.groupBy({
      by: ["paymentMethod"],
      where: { companyId, deletedAt: null, status: "COMPLETED" },
      _count: { _all: true },
      _sum: { totalCents: true },
    });
    const byMethod = new Map(grouped.map((g) => [g.paymentMethod, g]));
    return PAYMENT_METHODS.map((paymentMethod) => ({
      paymentMethod,
      count: byMethod.get(paymentMethod)?._count._all ?? 0,
      totalCents: byMethod.get(paymentMethod)?._sum.totalCents ?? 0,
    }));
  }
}

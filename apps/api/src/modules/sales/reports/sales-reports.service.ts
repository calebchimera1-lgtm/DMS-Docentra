import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"] as const;

@Injectable()
export class SalesReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async invoicesByStatus(companyId: string) {
    const grouped = await this.prisma.invoice.groupBy({
      by: ["status"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
      _sum: { totalCents: true },
    });

    const byStatus = new Map(grouped.map((g) => [g.status, g]));
    return {
      statuses: INVOICE_STATUSES.map((status) => ({
        status,
        count: byStatus.get(status)?._count._all ?? 0,
        totalCents: byStatus.get(status)?._sum.totalCents ?? 0,
      })),
    };
  }

  async summary(companyId: string) {
    const [productCount, openQuoteCount, openOrderCount, revenueBooked, revenueCollected, overdueInvoiceCount] =
      await Promise.all([
        this.prisma.product.count({ where: { companyId, deletedAt: null, isActive: true } }),
        this.prisma.quote.count({
          where: { companyId, deletedAt: null, status: { in: ["DRAFT", "SENT"] } },
        }),
        this.prisma.salesOrder.count({
          where: { companyId, deletedAt: null, status: { in: ["DRAFT", "CONFIRMED"] } },
        }),
        this.prisma.salesOrder.aggregate({
          where: { companyId, deletedAt: null, status: { not: "CANCELLED" } },
          _sum: { totalCents: true },
        }),
        this.prisma.invoice.aggregate({
          where: { companyId, deletedAt: null, status: "PAID" },
          _sum: { totalCents: true },
        }),
        this.prisma.invoice.count({ where: { companyId, deletedAt: null, status: "OVERDUE" } }),
      ]);

    return {
      productCount,
      openQuoteCount,
      openOrderCount,
      revenueBookedCents: revenueBooked._sum.totalCents ?? 0,
      revenueCollectedCents: revenueCollected._sum.totalCents ?? 0,
      overdueInvoiceCount,
    };
  }
}

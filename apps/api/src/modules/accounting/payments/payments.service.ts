import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import { formatDocumentNumber } from "../../sales/common/document-number.util";
import type { CreatePaymentDto } from "./dto/create-payment.dto";
import type { ListPaymentsQueryDto } from "./dto/list-payments-query.dto";

const EXPORT_ROW_LIMIT = 5000;

const paymentInclude = {
  invoice: { select: { id: true, invoiceNumber: true } },
  debitAccount: { select: { id: true, code: true, name: true } },
  creditAccount: { select: { id: true, code: true, name: true } },
  journalEntry: { select: { id: true, entryNumber: true } },
} as const;

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, query: ListPaymentsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      companyId,
      ...(query.search ? { reference: { contains: query.search, mode: "insensitive" as const } } : {}),
      ...(query.invoiceId ? { invoiceId: query.invoiceId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: paymentInclude,
        orderBy: { paymentDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id, companyId }, include: paymentInclude });
    if (!payment) {
      throw new NotFoundException("Payment not found");
    }
    return payment;
  }

  async create(companyId: string, userId: string, dto: CreatePaymentDto) {
    if (dto.debitAccountId === dto.creditAccountId) {
      throw new BadRequestException("Debit and credit accounts must be different");
    }

    const [debitAccount, creditAccount] = await Promise.all([
      this.prisma.ledgerAccount.findFirst({ where: { id: dto.debitAccountId, companyId, deletedAt: null } }),
      this.prisma.ledgerAccount.findFirst({ where: { id: dto.creditAccountId, companyId, deletedAt: null } }),
    ]);
    if (!debitAccount || !creditAccount) {
      throw new BadRequestException("Debit and credit accounts must belong to this company");
    }

    let invoice = null;
    if (dto.invoiceId) {
      invoice = await this.prisma.invoice.findFirst({
        where: { id: dto.invoiceId, companyId, deletedAt: null },
      });
      if (!invoice) {
        throw new NotFoundException("Invoice not found");
      }
      if (invoice.status === "PAID") {
        throw new BadRequestException("This invoice has already been paid");
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const journalEntryCount = await tx.journalEntry.count({ where: { companyId } });
      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          entryNumber: formatDocumentNumber("JE", journalEntryCount),
          entryDate: new Date(dto.paymentDate),
          memo: dto.reference ? `Payment: ${dto.reference}` : "Payment",
          status: "POSTED",
          createdById: userId,
          lines: {
            create: [
              {
                ledgerAccountId: dto.debitAccountId,
                debitCents: dto.amountCents,
                creditCents: 0,
                description: dto.note,
                lineOrder: 0,
              },
              {
                ledgerAccountId: dto.creditAccountId,
                debitCents: 0,
                creditCents: dto.amountCents,
                description: dto.note,
                lineOrder: 1,
              },
            ],
          },
        },
      });

      const payment = await tx.payment.create({
        data: {
          companyId,
          invoiceId: dto.invoiceId,
          amountCents: dto.amountCents,
          currency: dto.currency ?? "USD",
          method: dto.method ?? "BANK_TRANSFER",
          paymentDate: new Date(dto.paymentDate),
          debitAccountId: dto.debitAccountId,
          creditAccountId: dto.creditAccountId,
          journalEntryId: journalEntry.id,
          reference: dto.reference,
          note: dto.note,
          createdById: userId,
        },
        include: paymentInclude,
      });

      if (invoice) {
        await tx.invoice.update({ where: { id: invoice.id }, data: { status: "PAID", paidAt: new Date() } });
      }

      return payment;
    });
  }

  async exportCsv(companyId: string, query: Pick<ListPaymentsQueryDto, "search" | "invoiceId">): Promise<string> {
    const where = {
      companyId,
      ...(query.search ? { reference: { contains: query.search, mode: "insensitive" as const } } : {}),
      ...(query.invoiceId ? { invoiceId: query.invoiceId } : {}),
    };
    const rows = await this.prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: { paymentDate: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      paymentDate: r.paymentDate,
      amountCents: r.amountCents,
      method: r.method,
      invoiceNumber: r.invoice?.invoiceNumber ?? "",
      reference: r.reference ?? "",
    }));
    return toCsv(flat, ["paymentDate", "amountCents", "method", "invoiceNumber", "reference"]);
  }
}

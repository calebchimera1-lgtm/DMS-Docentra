import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import { formatDocumentNumber } from "../../sales/common/document-number.util";
import type { CreateJournalEntryDto } from "./dto/create-journal-entry.dto";
import type { JournalLineDto } from "./dto/journal-line.dto";
import type { ListJournalEntriesQueryDto } from "./dto/list-journal-entries-query.dto";

const EXPORT_ROW_LIMIT = 5000;

const journalEntryInclude = {
  lines: { include: { ledgerAccount: { select: { id: true, code: true, name: true } } } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class JournalEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every line must have exactly one non-zero side, and total debits must equal total credits. */
  private validateBalanced(
    lines: JournalLineDto[],
  ): { ledgerAccountId: string; debitCents: number; creditCents: number; description?: string }[] {
    const normalized = lines.map((line) => ({
      ledgerAccountId: line.ledgerAccountId,
      debitCents: line.debitCents ?? 0,
      creditCents: line.creditCents ?? 0,
      description: line.description,
    }));

    for (const line of normalized) {
      const sides = Number(line.debitCents > 0) + Number(line.creditCents > 0);
      if (sides !== 1) {
        throw new BadRequestException(
          "Each journal line must have exactly one of debitCents/creditCents greater than zero",
        );
      }
    }

    const totalDebit = normalized.reduce((sum, l) => sum + l.debitCents, 0);
    const totalCredit = normalized.reduce((sum, l) => sum + l.creditCents, 0);
    if (totalDebit !== totalCredit) {
      throw new BadRequestException(
        `Journal entry is not balanced: total debits ${totalDebit} != total credits ${totalCredit}`,
      );
    }
    if (totalDebit === 0) {
      throw new BadRequestException("Journal entry must have a non-zero total");
    }

    return normalized;
  }

  private async assertLedgerAccountsBelongToCompany(companyId: string, ledgerAccountIds: string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(ledgerAccountIds));
    const count = await this.prisma.ledgerAccount.count({
      where: { id: { in: uniqueIds }, companyId, deletedAt: null },
    });
    if (count !== uniqueIds.length) {
      throw new BadRequestException("One or more ledger accounts do not belong to this company");
    }
  }

  async list(companyId: string, query: ListJournalEntriesQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      companyId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { entryNumber: { contains: query.search, mode: "insensitive" as const } },
              { memo: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        include: journalEntryInclude,
        orderBy: { entryDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, companyId, deletedAt: null },
      include: journalEntryInclude,
    });
    if (!entry) {
      throw new NotFoundException("Journal entry not found");
    }
    return entry;
  }

  async create(companyId: string, userId: string, dto: CreateJournalEntryDto) {
    const normalizedLines = this.validateBalanced(dto.lines);
    await this.assertLedgerAccountsBelongToCompany(companyId, dto.lines.map((l) => l.ledgerAccountId));

    const count = await this.prisma.journalEntry.count({ where: { companyId } });
    return this.prisma.journalEntry.create({
      data: {
        companyId,
        entryNumber: formatDocumentNumber("JE", count),
        entryDate: new Date(dto.entryDate),
        memo: dto.memo,
        createdById: userId,
        lines: {
          create: normalizedLines.map((line, index) => ({
            ledgerAccountId: line.ledgerAccountId,
            debitCents: line.debitCents,
            creditCents: line.creditCents,
            description: line.description,
            lineOrder: index,
          })),
        },
      },
      include: journalEntryInclude,
    });
  }

  async post(companyId: string, id: string) {
    const entry = await this.findOne(companyId, id);
    if (entry.status !== "DRAFT") {
      throw new BadRequestException("Only a draft journal entry can be posted");
    }
    return this.prisma.journalEntry.update({
      where: { id },
      data: { status: "POSTED" },
      include: journalEntryInclude,
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    const entry = await this.findOne(companyId, id);
    if (entry.status !== "DRAFT") {
      throw new BadRequestException("A posted journal entry cannot be deleted");
    }
    await this.prisma.journalEntry.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListJournalEntriesQueryDto, "search" | "status">,
  ): Promise<string> {
    const where = {
      companyId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { entryNumber: { contains: query.search, mode: "insensitive" as const } },
              { memo: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const rows = await this.prisma.journalEntry.findMany({
      where,
      include: { lines: true },
      orderBy: { entryDate: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      entryNumber: r.entryNumber,
      entryDate: r.entryDate,
      status: r.status,
      memo: r.memo ?? "",
      totalDebitCents: r.lines.reduce((sum, l) => sum + l.debitCents, 0),
    }));
    return toCsv(flat, ["entryNumber", "entryDate", "status", "memo", "totalDebitCents"]);
  }
}

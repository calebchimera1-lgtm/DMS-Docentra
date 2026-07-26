import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import { formatDocumentNumber } from "../../sales/common/document-number.util";
import type { ExpenseLineDto, SnapshottedExpenseLine } from "../common/expense-line.dto";
import type { ApproveExpenseClaimDto } from "./dto/approve-expense-claim.dto";
import type { CreateExpenseClaimDto } from "./dto/create-expense-claim.dto";
import type { ListExpenseClaimsQueryDto } from "./dto/list-expense-claims-query.dto";
import type { RejectExpenseClaimDto } from "./dto/reject-expense-claim.dto";
import type { UpdateExpenseClaimDto } from "./dto/update-expense-claim.dto";

const EXPORT_ROW_LIMIT = 5000;

const claimInclude = {
  employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true, currency: true } },
  approvedBy: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
  journalEntry: { select: { id: true, entryNumber: true } },
} as const;

@Injectable()
export class ExpenseClaimsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListExpenseClaimsQueryDto, "search" | "status" | "employeeId">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search ? { claimNumber: { contains: query.search, mode: "insensitive" as const } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    };
  }

  private async resolveCurrentEmployee(companyId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { companyId, userId, deletedAt: null } });
    if (!employee) {
      throw new ForbiddenException("Only users with a linked employee profile can approve or reject expense claims");
    }
    return employee;
  }

  private async priceItems(
    companyId: string,
    items: ExpenseLineDto[],
  ): Promise<{ lines: SnapshottedExpenseLine[]; totalCents: number }> {
    const categoryIds = [...new Set(items.map((item) => item.categoryId))];
    const categories = await this.prisma.expenseCategory.findMany({
      where: { id: { in: categoryIds }, companyId, deletedAt: null },
    });
    const categoryById = new Map(categories.map((category) => [category.id, category]));

    const lines: SnapshottedExpenseLine[] = items.map((item) => {
      const category = categoryById.get(item.categoryId);
      if (!category || !category.isActive) {
        throw new BadRequestException(
          `Expense category ${item.categoryId} is not a valid, active category for this company`,
        );
      }
      return {
        categoryId: category.id,
        categoryName: category.name,
        description: item.description,
        amountCents: item.amountCents,
      };
    });
    const totalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
    return { lines, totalCents };
  }

  async list(companyId: string, query: ListExpenseClaimsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.expenseClaim.findMany({
        where,
        include: claimInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.expenseClaim.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const claim = await this.prisma.expenseClaim.findFirst({
      where: { id, companyId, deletedAt: null },
      include: claimInclude,
    });
    if (!claim) {
      throw new NotFoundException("Expense claim not found");
    }
    return claim;
  }

  async create(companyId: string, dto: CreateExpenseClaimDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, companyId, deletedAt: null },
    });
    if (!employee) {
      throw new BadRequestException("Employee does not belong to this company");
    }
    const { lines, totalCents } = await this.priceItems(companyId, dto.items);
    const count = await this.prisma.expenseClaim.count({ where: { companyId } });

    return this.prisma.expenseClaim.create({
      data: {
        companyId,
        employeeId: dto.employeeId,
        claimNumber: formatDocumentNumber("EXP", count),
        expenseDate: new Date(dto.expenseDate),
        items: lines as unknown as object,
        totalCents,
        currency: employee.currency,
        note: dto.note,
      },
      include: claimInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdateExpenseClaimDto) {
    const existing = await this.findOne(companyId, id);
    if (existing.status !== "DRAFT") {
      throw new BadRequestException("Only a draft expense claim can be edited");
    }

    let items: object | undefined;
    let totalCents: number | undefined;
    if (dto.items) {
      const priced = await this.priceItems(companyId, dto.items);
      items = priced.lines as unknown as object;
      totalCents = priced.totalCents;
    }

    return this.prisma.expenseClaim.update({
      where: { id },
      data: {
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
        note: dto.note,
        items,
        totalCents,
      },
      include: claimInclude,
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    const existing = await this.findOne(companyId, id);
    if (existing.status !== "DRAFT") {
      throw new ForbiddenException("Only a draft expense claim can be deleted");
    }
    await this.prisma.expenseClaim.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async submit(companyId: string, id: string) {
    const claim = await this.findOne(companyId, id);
    if (claim.status !== "DRAFT") {
      throw new BadRequestException("Only a draft expense claim can be submitted");
    }
    return this.prisma.expenseClaim.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
      include: claimInclude,
    });
  }

  /**
   * Posts a balanced JournalEntry: one debit line per category in the claim
   * (grouped and summed), crediting the reimbursement-payable account the
   * caller passes in. A real side effect, not a plain status update — same
   * precedent as Accounting's Payment.create and Purchase's receive() —
   * reached here via direct tx.* calls rather than injecting Accounting's
   * services, the same cross-module convention Purchase uses for Inventory.
   */
  async approve(companyId: string, currentUserId: string, id: string, dto: ApproveExpenseClaimDto) {
    const claim = await this.findOne(companyId, id);
    if (claim.status !== "SUBMITTED") {
      throw new BadRequestException("Only a submitted expense claim can be approved");
    }

    const creditAccount = await this.prisma.ledgerAccount.findFirst({
      where: { id: dto.creditAccountId, companyId, deletedAt: null },
    });
    if (!creditAccount) {
      throw new BadRequestException("Credit account does not belong to this company");
    }

    const lines = claim.items as unknown as SnapshottedExpenseLine[];
    const totalsByCategory = new Map<string, number>();
    for (const line of lines) {
      totalsByCategory.set(line.categoryId, (totalsByCategory.get(line.categoryId) ?? 0) + line.amountCents);
    }
    const categoryIds = [...totalsByCategory.keys()];
    const categories = await this.prisma.expenseCategory.findMany({ where: { id: { in: categoryIds }, companyId } });
    const categoryById = new Map(categories.map((category) => [category.id, category]));

    const debitLines: {
      ledgerAccountId: string;
      debitCents: number;
      creditCents: number;
      description: string;
      lineOrder: number;
    }[] = [];
    let lineOrder = 0;
    for (const [categoryId, amountCents] of totalsByCategory) {
      const category = categoryById.get(categoryId);
      if (!category?.ledgerAccountId) {
        throw new BadRequestException(
          `Expense category "${category?.name ?? categoryId}" has no ledger account mapped — set one before approving`,
        );
      }
      debitLines.push({
        ledgerAccountId: category.ledgerAccountId,
        debitCents: amountCents,
        creditCents: 0,
        description: `${claim.claimNumber}: ${category.name}`,
        lineOrder: lineOrder++,
      });
    }

    const approver = await this.resolveCurrentEmployee(companyId, currentUserId);

    return this.prisma.$transaction(async (tx) => {
      const journalEntryCount = await tx.journalEntry.count({ where: { companyId } });
      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          entryNumber: formatDocumentNumber("JE", journalEntryCount),
          entryDate: new Date(),
          memo: `Expense claim ${claim.claimNumber}`,
          status: "POSTED",
          createdById: currentUserId,
          lines: {
            create: [
              ...debitLines,
              {
                ledgerAccountId: dto.creditAccountId,
                debitCents: 0,
                creditCents: claim.totalCents,
                description: `${claim.claimNumber}: reimbursement payable`,
                lineOrder,
              },
            ],
          },
        },
      });

      return tx.expenseClaim.update({
        where: { id: claim.id },
        data: {
          status: "APPROVED",
          approvedById: approver.id,
          approvedAt: new Date(),
          journalEntryId: journalEntry.id,
        },
        include: claimInclude,
      });
    });
  }

  async reject(companyId: string, currentUserId: string, id: string, dto: RejectExpenseClaimDto) {
    const claim = await this.findOne(companyId, id);
    if (claim.status !== "SUBMITTED") {
      throw new BadRequestException("Only a submitted expense claim can be rejected");
    }
    const approver = await this.resolveCurrentEmployee(companyId, currentUserId);
    return this.prisma.expenseClaim.update({
      where: { id },
      data: {
        status: "REJECTED",
        approvedById: approver.id,
        approvedAt: new Date(),
        rejectionReason: dto.rejectionReason,
      },
      include: claimInclude,
    });
  }

  async cancel(companyId: string, id: string) {
    const claim = await this.findOne(companyId, id);
    if (claim.status !== "DRAFT" && claim.status !== "SUBMITTED") {
      throw new BadRequestException("Only a draft or submitted expense claim can be cancelled");
    }
    return this.prisma.expenseClaim.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: claimInclude,
    });
  }

  async markPaid(companyId: string, id: string) {
    const claim = await this.findOne(companyId, id);
    if (claim.status !== "APPROVED") {
      throw new BadRequestException("Only an approved expense claim can be marked paid");
    }
    return this.prisma.expenseClaim.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date() },
      include: claimInclude,
    });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListExpenseClaimsQueryDto, "search" | "status" | "employeeId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.expenseClaim.findMany({
      where,
      include: claimInclude,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      claimNumber: r.claimNumber,
      employeeNumber: r.employee.employeeNumber,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      expenseDate: r.expenseDate,
      totalCents: r.totalCents,
      status: r.status,
    }));
    return toCsv(flat, ["claimNumber", "employeeNumber", "employeeName", "expenseDate", "totalCents", "status"]);
  }
}

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { toCsv } from "../../common/utils/csv.util";
import { formatDocumentNumber } from "../sales/common/document-number.util";
import type { CreateContractDto } from "./dto/create-contract.dto";
import type { ListContractsQueryDto } from "./dto/list-contracts-query.dto";
import type { RenewContractDto } from "./dto/renew-contract.dto";
import type { TerminateContractDto } from "./dto/terminate-contract.dto";
import type { UpdateContractDto } from "./dto/update-contract.dto";

const EXPORT_ROW_LIMIT = 5000;

const contractInclude = {
  account: { select: { id: true, name: true } },
  owner: { select: { id: true, firstName: true, lastName: true } },
  parentContract: { select: { id: true, contractNumber: true } },
  renewedAsContract: { select: { id: true, contractNumber: true } },
} as const;

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(
    companyId: string,
    query: Pick<ListContractsQueryDto, "search" | "status" | "type" | "accountId">,
  ) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" as const } },
              { contractNumber: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
    };
  }

  async list(companyId: string, query: ListContractsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        include: contractInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.contract.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, companyId, deletedAt: null },
      include: contractInclude,
    });
    if (!contract) {
      throw new NotFoundException("Contract not found");
    }
    return contract;
  }

  private async assertAccountBelongs(companyId: string, accountId: string) {
    const account = await this.prisma.crmAccount.findFirst({ where: { id: accountId, companyId, deletedAt: null } });
    if (!account) {
      throw new BadRequestException("Account does not belong to this company");
    }
  }

  async create(companyId: string, userId: string, dto: CreateContractDto) {
    if (dto.accountId) {
      await this.assertAccountBelongs(companyId, dto.accountId);
    }
    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException("End date cannot be before start date");
    }

    const count = await this.prisma.contract.count({ where: { companyId } });
    return this.prisma.contract.create({
      data: {
        companyId,
        contractNumber: formatDocumentNumber("CON", count),
        title: dto.title,
        type: dto.type,
        accountId: dto.accountId,
        ownerId: dto.ownerId ?? userId,
        valueCents: dto.valueCents ?? 0,
        currency: dto.currency ?? "USD",
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        autoRenew: dto.autoRenew ?? false,
        renewalTermMonths: dto.renewalTermMonths,
        note: dto.note,
      },
      include: contractInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdateContractDto) {
    const existing = await this.findOne(companyId, id);
    if (existing.status !== "DRAFT") {
      throw new BadRequestException("Only a draft contract can be edited");
    }
    if (dto.accountId) {
      await this.assertAccountBelongs(companyId, dto.accountId);
    }
    const startDate = dto.startDate ? new Date(dto.startDate) : existing.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : existing.endDate;
    if (endDate < startDate) {
      throw new BadRequestException("End date cannot be before start date");
    }

    return this.prisma.contract.update({
      where: { id },
      data: {
        title: dto.title,
        type: dto.type,
        accountId: dto.accountId,
        ownerId: dto.ownerId,
        valueCents: dto.valueCents,
        currency: dto.currency,
        startDate: dto.startDate ? startDate : undefined,
        endDate: dto.endDate ? endDate : undefined,
        autoRenew: dto.autoRenew,
        renewalTermMonths: dto.renewalTermMonths,
        note: dto.note,
      },
      include: contractInclude,
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    const existing = await this.findOne(companyId, id);
    if (existing.status !== "DRAFT") {
      throw new ForbiddenException("Only a draft contract can be deleted");
    }
    await this.prisma.contract.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async activate(companyId: string, id: string) {
    const contract = await this.findOne(companyId, id);
    if (contract.status !== "DRAFT") {
      throw new BadRequestException("Only a draft contract can be activated");
    }
    return this.prisma.contract.update({ where: { id }, data: { status: "ACTIVE" }, include: contractInclude });
  }

  async terminate(companyId: string, id: string, dto: TerminateContractDto) {
    const contract = await this.findOne(companyId, id);
    if (contract.status !== "ACTIVE") {
      throw new BadRequestException("Only an active contract can be terminated");
    }
    return this.prisma.contract.update({
      where: { id },
      data: { status: "TERMINATED", terminatedAt: new Date(), terminationReason: dto.terminationReason },
      include: contractInclude,
    });
  }

  async expire(companyId: string, id: string) {
    const contract = await this.findOne(companyId, id);
    if (contract.status !== "ACTIVE") {
      throw new BadRequestException("Only an active contract can be marked expired");
    }
    return this.prisma.contract.update({ where: { id }, data: { status: "EXPIRED" }, include: contractInclude });
  }

  /**
   * Renewing doesn't mutate the existing contract's dates — it creates a
   * successor Contract (parentContractId pointing back at this one),
   * starting where this term ends, and marks this one RENEWED. The same
   * "conversion creates a new linked record rather than mutating in place"
   * precedent as CRM's lead conversion and Recruitment's hire.
   */
  async renew(companyId: string, id: string, dto: RenewContractDto) {
    const contract = await this.findOne(companyId, id);
    if (contract.status !== "ACTIVE") {
      throw new BadRequestException("Only an active contract can be renewed");
    }
    if (new Date(dto.endDate) <= contract.endDate) {
      throw new BadRequestException("The renewal end date must be after the current contract's end date");
    }

    return this.prisma.$transaction(async (tx) => {
      const count = await tx.contract.count({ where: { companyId } });
      const successor = await tx.contract.create({
        data: {
          companyId,
          contractNumber: formatDocumentNumber("CON", count),
          title: contract.title,
          type: contract.type,
          accountId: contract.accountId,
          ownerId: contract.ownerId,
          status: "ACTIVE",
          valueCents: dto.valueCents ?? contract.valueCents,
          currency: contract.currency,
          startDate: contract.endDate,
          endDate: new Date(dto.endDate),
          autoRenew: contract.autoRenew,
          renewalTermMonths: contract.renewalTermMonths,
          parentContractId: contract.id,
        },
        include: contractInclude,
      });

      await tx.contract.update({ where: { id: contract.id }, data: { status: "RENEWED" } });

      return successor;
    });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListContractsQueryDto, "search" | "status" | "type" | "accountId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.contract.findMany({
      where,
      include: contractInclude,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      contractNumber: r.contractNumber,
      title: r.title,
      type: r.type,
      account: r.account?.name ?? "",
      valueCents: r.valueCents,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
    }));
    return toCsv(flat, ["contractNumber", "title", "type", "account", "valueCents", "startDate", "endDate", "status"]);
  }
}

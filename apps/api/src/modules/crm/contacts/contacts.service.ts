import { Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreateContactDto } from "./dto/create-contact.dto";
import type { ListContactsQueryDto } from "./dto/list-contacts-query.dto";
import type { UpdateContactDto } from "./dto/update-contact.dto";

const EXPORT_ROW_LIMIT = 5000;

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListContactsQueryDto, "search" | "accountId" | "ownerId">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" as const } },
              { lastName: { contains: query.search, mode: "insensitive" as const } },
              { email: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    };
  }

  async list(companyId: string, query: ListContactsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.crmContact.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          account: { select: { id: true, name: true } },
          owner: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.crmContact.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const contact = await this.prisma.crmContact.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        account: { select: { id: true, name: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
        deals: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!contact) {
      throw new NotFoundException("Contact not found");
    }
    return contact;
  }

  async create(companyId: string, dto: CreateContactDto) {
    if (dto.accountId) {
      await this.assertAccountBelongsToCompany(companyId, dto.accountId);
    }
    return this.prisma.crmContact.create({ data: { companyId, ...dto } });
  }

  async update(companyId: string, id: string, dto: UpdateContactDto) {
    await this.assertExists(companyId, id);
    if (dto.accountId) {
      await this.assertAccountBelongsToCompany(companyId, dto.accountId);
    }
    return this.prisma.crmContact.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.assertExists(companyId, id);
    await this.prisma.crmContact.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListContactsQueryDto, "search" | "accountId" | "ownerId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.crmContact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, title: true, createdAt: true },
    });
    return toCsv(rows, ["id", "firstName", "lastName", "email", "phone", "title", "createdAt"]);
  }

  private async assertExists(companyId: string, id: string): Promise<void> {
    const count = await this.prisma.crmContact.count({ where: { id, companyId, deletedAt: null } });
    if (count === 0) {
      throw new NotFoundException("Contact not found");
    }
  }

  private async assertAccountBelongsToCompany(companyId: string, accountId: string): Promise<void> {
    const count = await this.prisma.crmAccount.count({ where: { id: accountId, companyId, deletedAt: null } });
    if (count === 0) {
      throw new NotFoundException("Account not found");
    }
  }
}

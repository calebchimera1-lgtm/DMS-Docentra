import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { PaginatedResult } from "@omniflow/shared";
import type { UserStatus } from "@omniflow/database";
import { PrismaService } from "../../prisma/prisma.service";
import { DomainEvents } from "../../common/events/domain-events";
import type { AssignBranchDto } from "./dto/assign-branch.dto";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { GrantRoleDto } from "./dto/grant-role.dto";
import type { ListUsersQueryDto } from "./dto/list-users-query.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";

const BCRYPT_ROUNDS = 12;

const userListInclude = {
  branches: { include: { branch: { select: { id: true, name: true, code: true } } } },
  roles: { include: { role: { select: { id: true, name: true } } } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async list(companyId: string, query: ListUsersQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = {
      companyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" as const } },
              { lastName: { contains: query.search, mode: "insensitive" as const } },
              { email: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.roleId ? { roles: { some: { roleId: query.roleId } } } : {}),
      ...(query.branchId ? { branches: { some: { branchId: query.branchId } } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: userListInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId, deletedAt: null },
      include: userListInclude,
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  async create(companyId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    if (dto.branchIds?.length) {
      await this.assertBranchesBelongToCompany(companyId, dto.branchIds);
    }
    if (dto.roleIds?.length) {
      await this.assertRolesBelongToCompany(companyId, dto.roleIds);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          companyId,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
        },
      });

      if (dto.branchIds?.length) {
        await tx.userBranch.createMany({
          data: dto.branchIds.map((branchId, index) => ({
            userId: user.id,
            branchId,
            isPrimary: index === 0,
          })),
        });
      }

      if (dto.roleIds?.length) {
        await tx.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({ userId: user.id, roleId, branchId: null })),
        });
      }

      return tx.user.findUniqueOrThrow({ where: { id: user.id }, include: userListInclude });
    }).then((user) => {
      this.events.emit(DomainEvents.USER_CREATED, {
        userId: user.id,
        companyId: user.companyId,
        email: user.email,
      });
      return user;
    });
  }

  async update(companyId: string, id: string, dto: UpdateUserDto) {
    await this.findOne(companyId, id);

    const data: { firstName?: string; lastName?: string; phone?: string; status?: UserStatus } = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.status !== undefined) data.status = dto.status;

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      include: userListInclude,
    });

    if (dto.status && dto.status !== "ACTIVE") {
      await this.prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return updated;
  }

  async remove(companyId: string, id: string, requestingUserId: string): Promise<void> {
    if (id === requestingUserId) {
      throw new ForbiddenException("You cannot delete your own account");
    }
    await this.findOne(companyId, id);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { status: "INACTIVE", deletedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async assignBranch(companyId: string, userId: string, dto: AssignBranchDto) {
    await this.findOne(companyId, userId);
    await this.assertBranchesBelongToCompany(companyId, [dto.branchId]);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.userBranch.updateMany({ where: { userId }, data: { isPrimary: false } });
      }
      return tx.userBranch.upsert({
        where: { userId_branchId: { userId, branchId: dto.branchId } },
        update: { isPrimary: dto.isPrimary ?? false },
        create: { userId, branchId: dto.branchId, isPrimary: dto.isPrimary ?? false },
      });
    });
  }

  async removeBranch(companyId: string, userId: string, branchId: string): Promise<void> {
    await this.findOne(companyId, userId);
    await this.prisma.userBranch.deleteMany({ where: { userId, branchId } });
  }

  async grantRole(companyId: string, userId: string, dto: GrantRoleDto) {
    await this.findOne(companyId, userId);
    const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, companyId } });
    if (!role) {
      throw new BadRequestException("One or more roles do not belong to this company");
    }
    if (dto.branchId) {
      await this.assertBranchesBelongToCompany(companyId, [dto.branchId]);
    }

    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId: dto.roleId, branchId: dto.branchId ?? null },
    });
    if (existing) {
      return existing;
    }

    const grant = await this.prisma.userRole.create({
      data: { userId, roleId: dto.roleId, branchId: dto.branchId ?? null },
    });

    this.events.emit(DomainEvents.ROLE_GRANTED, { userId, companyId, roleName: role.name });

    return grant;
  }

  async revokeRole(companyId: string, userId: string, userRoleId: string): Promise<void> {
    await this.findOne(companyId, userId);
    await this.prisma.userRole.deleteMany({ where: { id: userRoleId, userId } });
  }

  private async assertBranchesBelongToCompany(companyId: string, branchIds: string[]): Promise<void> {
    const count = await this.prisma.branch.count({ where: { id: { in: branchIds }, companyId } });
    if (count !== new Set(branchIds).size) {
      throw new BadRequestException("One or more branches do not belong to this company");
    }
  }

  private async assertRolesBelongToCompany(companyId: string, roleIds: string[]): Promise<void> {
    const count = await this.prisma.role.count({ where: { id: { in: roleIds }, companyId } });
    if (count !== new Set(roleIds).size) {
      throw new BadRequestException("One or more roles do not belong to this company");
    }
  }
}

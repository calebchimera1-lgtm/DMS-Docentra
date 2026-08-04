import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@omniflow/database";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateBranchDto } from "./dto/create-branch.dto";
import type { UpdateBranchDto } from "./dto/update-branch.dto";

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  list(companyId: string) {
    return this.prisma.branch.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: "asc" },
    });
  }

  async findOne(companyId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!branch) {
      throw new NotFoundException("Branch not found");
    }
    return branch;
  }

  async create(companyId: string, dto: CreateBranchDto) {
    try {
      return await this.prisma.branch.create({
        data: {
          companyId,
          name: dto.name,
          code: dto.code,
          isHeadquarters: dto.isHeadquarters ?? false,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: dto.city,
          state: dto.state,
          country: dto.country,
          postalCode: dto.postalCode,
          phone: dto.phone,
          email: dto.email,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A branch with this code already exists");
      }
      throw error;
    }
  }

  async update(companyId: string, id: string, dto: UpdateBranchDto) {
    await this.findOne(companyId, id);
    return this.prisma.branch.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string): Promise<void> {
    const branch = await this.findOne(companyId, id);
    if (branch.isHeadquarters) {
      throw new ForbiddenException("The headquarters branch cannot be deleted");
    }

    const assignmentCount = await this.prisma.userBranch.count({ where: { branchId: id } });
    if (assignmentCount > 0) {
      throw new ConflictException(
        `This branch still has ${assignmentCount} user(s) assigned — reassign them first`,
      );
    }

    await this.prisma.branch.update({ where: { id }, data: { deletedAt: new Date(), status: "INACTIVE" } });
  }
}

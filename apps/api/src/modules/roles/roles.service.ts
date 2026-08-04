import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@omniflow/database";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateRoleDto } from "./dto/create-role.dto";
import type { UpdateRoleDto } from "./dto/update-role.dto";

const roleInclude = {
  permissions: { include: { permission: { select: { id: true, key: true, module: true, action: true } } } },
} as const;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  list(companyId: string) {
    return this.prisma.role.findMany({
      where: { companyId },
      include: roleInclude,
      orderBy: { name: "asc" },
    });
  }

  async findOne(companyId: string, id: string) {
    const role = await this.prisma.role.findFirst({ where: { id, companyId }, include: roleInclude });
    if (!role) {
      throw new NotFoundException("Role not found");
    }
    return role;
  }

  async create(companyId: string, dto: CreateRoleDto) {
    const permissionIds = await this.resolvePermissionIds(dto.permissionKeys);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const role = await tx.role.create({
          data: { companyId, name: dto.name, description: dto.description, isSystem: false },
        });
        if (permissionIds.length) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
          });
        }
        return tx.role.findUniqueOrThrow({ where: { id: role.id }, include: roleInclude });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A role with this name already exists");
      }
      throw error;
    }
  }

  async update(companyId: string, id: string, dto: UpdateRoleDto) {
    const role = await this.findOne(companyId, id);
    if (role.isSystem) {
      throw new ForbiddenException("System roles cannot be modified");
    }

    const permissionIds = dto.permissionKeys ? await this.resolvePermissionIds(dto.permissionKeys) : undefined;

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.role.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
          },
        });

        if (permissionIds) {
          await tx.rolePermission.deleteMany({ where: { roleId: id } });
          if (permissionIds.length) {
            await tx.rolePermission.createMany({
              data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
            });
          }
        }

        return tx.role.findUniqueOrThrow({ where: { id }, include: roleInclude });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A role with this name already exists");
      }
      throw error;
    }
  }

  async remove(companyId: string, id: string): Promise<void> {
    const role = await this.findOne(companyId, id);
    if (role.isSystem) {
      throw new ForbiddenException("System roles cannot be deleted");
    }

    const assignmentCount = await this.prisma.userRole.count({ where: { roleId: id } });
    if (assignmentCount > 0) {
      throw new ConflictException(
        `This role is still granted to ${assignmentCount} user(s) — revoke those grants first`,
      );
    }

    await this.prisma.role.delete({ where: { id } });
  }

  private async resolvePermissionIds(keys: string[]): Promise<string[]> {
    if (keys.length === 0) {
      return [];
    }
    const uniqueKeys = Array.from(new Set(keys));
    const permissions = await this.prisma.permission.findMany({ where: { key: { in: uniqueKeys } } });
    if (permissions.length !== uniqueKeys.length) {
      const found = new Set(permissions.map((p) => p.key));
      const missing = uniqueKeys.filter((key) => !found.has(key));
      throw new BadRequestException(`Unknown permission key(s): ${missing.join(", ")}`);
    }
    return permissions.map((p) => p.id);
  }
}

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PERMISSION_CATALOG } from "@omniflow/shared";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PermissionsService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensures the permission catalog exists at boot, so RBAC works even in
   * an environment where `pnpm db:seed` was never run (the migration
   * only creates the `permissions` table — it doesn't populate it).
   * Idempotent: safe to run on every startup.
   */
  async onModuleInit(): Promise<void> {
    for (const definition of PERMISSION_CATALOG) {
      await this.prisma.permission.upsert({
        where: { key: definition.key },
        update: {
          module: definition.module,
          action: definition.action,
          description: definition.description,
        },
        create: definition,
      });
    }
    this.logger.log(`Permission catalog ready (${PERMISSION_CATALOG.length} permissions).`);
  }

  async list() {
    return this.prisma.permission.findMany({ orderBy: [{ module: "asc" }, { action: "asc" }] });
  }
}

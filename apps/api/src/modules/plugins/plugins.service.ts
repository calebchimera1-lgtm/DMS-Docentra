import { Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@omniflow/database";
import { PrismaService } from "../../prisma/prisma.service";
import { PLUGIN_CATALOG } from "./plugin-catalog";

@Injectable()
export class PluginsService implements OnModuleInit {
  private readonly logger = new Logger(PluginsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    for (const definition of PLUGIN_CATALOG) {
      await this.prisma.plugin.upsert({
        where: { key: definition.key },
        update: {
          name: definition.name,
          description: definition.description,
          version: definition.version,
          author: definition.author,
        },
        create: definition,
      });
    }
    this.logger.log(`Plugin catalog ready (${PLUGIN_CATALOG.length} plugins).`);
  }

  catalog() {
    return this.prisma.plugin.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  }

  installedForCompany(companyId: string) {
    return this.prisma.companyPlugin.findMany({
      where: { companyId },
      include: { plugin: true },
    });
  }

  async enable(companyId: string, pluginKey: string, config?: Prisma.InputJsonValue) {
    const plugin = await this.prisma.plugin.findUnique({ where: { key: pluginKey } });
    if (!plugin) {
      throw new NotFoundException(`Unknown plugin: ${pluginKey}`);
    }

    return this.prisma.companyPlugin.upsert({
      where: { companyId_pluginId: { companyId, pluginId: plugin.id } },
      update: { isEnabled: true, config },
      create: { companyId, pluginId: plugin.id, isEnabled: true, config },
    });
  }

  async disable(companyId: string, pluginKey: string): Promise<void> {
    const plugin = await this.prisma.plugin.findUnique({ where: { key: pluginKey } });
    if (!plugin) {
      throw new NotFoundException(`Unknown plugin: ${pluginKey}`);
    }
    await this.prisma.companyPlugin.updateMany({
      where: { companyId, pluginId: plugin.id },
      data: { isEnabled: false },
    });
  }

  /** Used by the event bridge — returns the enabled config for one plugin, or null if not enabled. */
  async getEnabledConfig(companyId: string, pluginKey: string): Promise<Record<string, unknown> | null> {
    const companyPlugin = await this.prisma.companyPlugin.findFirst({
      where: { companyId, isEnabled: true, plugin: { key: pluginKey } },
    });
    return (companyPlugin?.config as Record<string, unknown> | null) ?? null;
  }
}

import { Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@omniflow/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthorizationService } from "../../common/authorization/authorization.service";
import { PLUGIN_CATALOG } from "./plugin-catalog";

export interface NavItem {
  key: string;
  name: string;
  icon: string | null;
  route: string | null;
}

@Injectable()
export class PluginsService implements OnModuleInit {
  private readonly logger = new Logger(PluginsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const definition of PLUGIN_CATALOG) {
      await this.prisma.plugin.upsert({
        where: { key: definition.key },
        update: {
          kind: definition.kind,
          name: definition.name,
          description: definition.description,
          version: definition.version,
          author: definition.author,
          icon: definition.icon,
          route: definition.route,
          permissionModule: definition.permissionModule,
          sortOrder: definition.sortOrder ?? 0,
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

  /**
   * The sidebar's data source: this company's installed, enabled MODULE
   * plugins, filtered to the ones the current user actually has
   * `<permissionModule>:read` for (a module with no permissionModule —
   * Dashboard — is always visible to anyone in the company). Nothing here
   * is hard-coded per module; installing/enabling a Plugin is what makes
   * it appear.
   */
  async navigationForUser(companyId: string, userId: string): Promise<NavItem[]> {
    const [installed, effectivePermissions] = await Promise.all([
      this.prisma.companyPlugin.findMany({
        where: { companyId, isEnabled: true, plugin: { kind: "MODULE", isActive: true } },
        include: { plugin: true },
      }),
      this.authorization.getEffectivePermissions(userId),
    ]);

    return installed
      .map((companyPlugin) => companyPlugin.plugin)
      .filter((plugin) => !plugin.permissionModule || effectivePermissions.has(`${plugin.permissionModule}:read`))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((plugin) => ({ key: plugin.key, name: plugin.name, icon: plugin.icon, route: plugin.route }));
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

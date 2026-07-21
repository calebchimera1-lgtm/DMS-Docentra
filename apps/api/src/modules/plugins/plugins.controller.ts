import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import type { Prisma } from "@omniflow/database";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../auth/interfaces/jwt-payload.interface";
import { EnablePluginDto } from "./dto/enable-plugin.dto";
import { PluginsService } from "./plugins.service";

@ApiTags("plugins")
@ApiBearerAuth()
@Controller("plugins")
@RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
export class PluginsController {
  constructor(private readonly pluginsService: PluginsService) {}

  @Get()
  @ApiOperation({ summary: "The full plugin catalog" })
  catalog() {
    return this.pluginsService.catalog();
  }

  @Get("installed")
  @ApiOperation({ summary: "This company's plugin install/enable state" })
  installed(@CurrentUser() user: RequestUser) {
    return this.pluginsService.installedForCompany(user.companyId);
  }

  @Post(":key/enable")
  @ApiOperation({ summary: "Enable a plugin for this company, optionally with config (e.g. a webhook URL)" })
  enable(@CurrentUser() user: RequestUser, @Param("key") key: string, @Body() dto: EnablePluginDto) {
    return this.pluginsService.enable(user.companyId, key, dto.config as Prisma.InputJsonValue | undefined);
  }

  @Post(":key/disable")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Disable a plugin for this company" })
  async disable(@CurrentUser() user: RequestUser, @Param("key") key: string): Promise<void> {
    await this.pluginsService.disable(user.companyId, key);
  }
}

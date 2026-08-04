import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PermissionsService } from "./permissions.service";

@ApiTags("permissions")
@ApiBearerAuth()
@Controller("permissions")
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: "List the full permission catalog (for building a role/permission matrix editor)" })
  list() {
    return this.permissionsService.list();
  }
}

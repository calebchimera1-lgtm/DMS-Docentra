import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { InventoryReportsService } from "./inventory-reports.service";

@ApiTags("inventory-reports")
@ApiBearerAuth()
@Controller("inventory/reports")
@RequirePermissions(PERMISSIONS.INVENTORY_READ)
export class InventoryReportsController {
  constructor(private readonly reportsService: InventoryReportsService) {}

  @Get("summary")
  @ApiOperation({ summary: "Top-line inventory stats for the module dashboard" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Get("movements-by-type")
  @ApiOperation({ summary: "Stock movement count grouped by type" })
  movementsByType(@CurrentUser() user: RequestUser) {
    return this.reportsService.movementsByType(user.companyId);
  }
}

import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { PurchaseReportsService } from "./purchase-reports.service";

@ApiTags("purchase-reports")
@ApiBearerAuth()
@Controller("purchase/reports")
@RequirePermissions(PERMISSIONS.PURCHASE_READ)
export class PurchaseReportsController {
  constructor(private readonly reportsService: PurchaseReportsService) {}

  @Get("summary")
  @ApiOperation({ summary: "Top-line purchasing stats for the module dashboard" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Get("orders-by-status")
  @ApiOperation({ summary: "Purchase order counts grouped by status" })
  ordersByStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.ordersByStatus(user.companyId);
  }
}

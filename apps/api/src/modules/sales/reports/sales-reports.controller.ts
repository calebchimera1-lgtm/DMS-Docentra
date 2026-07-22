import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { SalesReportsService } from "./sales-reports.service";

@ApiTags("sales-reports")
@ApiBearerAuth()
@Controller("sales/reports")
@RequirePermissions(PERMISSIONS.SALES_READ)
export class SalesReportsController {
  constructor(private readonly reportsService: SalesReportsService) {}

  @Get("summary")
  @ApiOperation({ summary: "Top-line sales stats for the module dashboard" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Get("invoices-by-status")
  @ApiOperation({ summary: "Invoice count and value grouped by status" })
  invoicesByStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.invoicesByStatus(user.companyId);
  }
}

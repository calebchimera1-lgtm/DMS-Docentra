import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { BillingReportsService } from "./billing-reports.service";

@ApiTags("billing-reports")
@ApiBearerAuth()
@Controller("billing/reports")
export class BillingReportsController {
  constructor(private readonly reportsService: BillingReportsService) {}

  @Get("summary")
  @RequirePermissions(PERMISSIONS.BILLING_READ)
  @ApiOperation({ summary: "Subscription counts plus MRR/ARR normalised across billing intervals" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Get("by-status")
  @RequirePermissions(PERMISSIONS.BILLING_READ)
  @ApiOperation({ summary: "Subscription counts grouped by status" })
  byStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.byStatus(user.companyId);
  }
}

import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { PosReportsService } from "./pos-reports.service";

@ApiTags("pos-reports")
@ApiBearerAuth()
@Controller("pos/reports")
export class PosReportsController {
  constructor(private readonly reportsService: PosReportsService) {}

  @Get("summary")
  @RequirePermissions(PERMISSIONS.POS_READ)
  @ApiOperation({ summary: "Open session count, sale outcome counts, and total completed sales value" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Get("by-payment-method")
  @RequirePermissions(PERMISSIONS.POS_READ)
  @ApiOperation({ summary: "Completed sale count and value grouped by payment method" })
  byPaymentMethod(@CurrentUser() user: RequestUser) {
    return this.reportsService.byPaymentMethod(user.companyId);
  }
}

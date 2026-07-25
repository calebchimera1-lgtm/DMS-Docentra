import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { SupportReportsService } from "./support-reports.service";

@ApiTags("support-reports")
@ApiBearerAuth()
@Controller("support/reports")
@RequirePermissions(PERMISSIONS.SUPPORT_READ)
export class SupportReportsController {
  constructor(private readonly reportsService: SupportReportsService) {}

  @Get("summary")
  @ApiOperation({ summary: "Top-line support stats for the module dashboard (open/unassigned/overdue tickets)" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Get("tickets-by-status")
  @ApiOperation({ summary: "Ticket counts grouped by status" })
  ticketsByStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.ticketsByStatus(user.companyId);
  }
}

import { Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { SupportReportsService } from "./support-reports.service";
import { SupportSummaryType, TicketsByStatusType } from "./graphql/support-summary.type";

@Resolver()
@RequirePermissions(PERMISSIONS.SUPPORT_READ)
export class SupportReportsResolver {
  constructor(private readonly reportsService: SupportReportsService) {}

  @Query(() => SupportSummaryType, { name: "supportSummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Query(() => [TicketsByStatusType], { name: "supportTicketsByStatus" })
  ticketsByStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.ticketsByStatus(user.companyId);
  }
}

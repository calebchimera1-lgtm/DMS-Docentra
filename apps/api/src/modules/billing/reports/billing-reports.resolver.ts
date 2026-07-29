import { Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { BillingReportsService } from "./billing-reports.service";
import { BillingSummaryType, SubscriptionsByStatusType } from "./graphql/billing-summary.type";

@Resolver()
@RequirePermissions(PERMISSIONS.BILLING_READ)
export class BillingReportsResolver {
  constructor(private readonly reportsService: BillingReportsService) {}

  @Query(() => BillingSummaryType, { name: "billingSummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Query(() => [SubscriptionsByStatusType], { name: "subscriptionsByStatus" })
  byStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.byStatus(user.companyId);
  }
}

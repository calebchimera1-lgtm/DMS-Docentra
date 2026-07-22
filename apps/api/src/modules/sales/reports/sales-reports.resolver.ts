import { Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { SalesSummaryType } from "./graphql/sales-summary.type";
import { SalesReportsService } from "./sales-reports.service";

@Resolver()
@RequirePermissions(PERMISSIONS.SALES_READ)
export class SalesReportsResolver {
  constructor(private readonly reportsService: SalesReportsService) {}

  @Query(() => SalesSummaryType, { name: "salesSummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }
}

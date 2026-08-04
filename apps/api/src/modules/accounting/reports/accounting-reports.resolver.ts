import { Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { AccountingReportsService } from "./accounting-reports.service";
import { AccountingSummaryType } from "./graphql/accounting-summary.type";

@Resolver()
@RequirePermissions(PERMISSIONS.ACCOUNTING_READ)
export class AccountingReportsResolver {
  constructor(private readonly reportsService: AccountingReportsService) {}

  @Query(() => AccountingSummaryType, { name: "accountingSummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }
}

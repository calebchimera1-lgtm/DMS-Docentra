import { Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CrmReportsService } from "./crm-reports.service";
import { CrmSummaryType } from "./graphql/crm-summary.type";

@Resolver()
@RequirePermissions(PERMISSIONS.CRM_READ)
export class CrmReportsResolver {
  constructor(private readonly reportsService: CrmReportsService) {}

  @Query(() => CrmSummaryType, { name: "crmSummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }
}

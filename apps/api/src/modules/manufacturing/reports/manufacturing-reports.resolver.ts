import { Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ManufacturingReportsService } from "./manufacturing-reports.service";
import { ManufacturingSummaryType, WorkOrdersByStatusType } from "./graphql/manufacturing-summary.type";

@Resolver()
@RequirePermissions(PERMISSIONS.MANUFACTURING_READ)
export class ManufacturingReportsResolver {
  constructor(private readonly reportsService: ManufacturingReportsService) {}

  @Query(() => ManufacturingSummaryType, { name: "manufacturingSummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Query(() => [WorkOrdersByStatusType], { name: "workOrdersByStatus" })
  byStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.byStatus(user.companyId);
  }
}

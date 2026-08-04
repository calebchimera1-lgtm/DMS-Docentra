import { Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { LogisticsReportsService } from "./logistics-reports.service";
import { LogisticsSummaryType, ShipmentsByStatusType } from "./graphql/logistics-summary.type";

@Resolver()
@RequirePermissions(PERMISSIONS.LOGISTICS_READ)
export class LogisticsReportsResolver {
  constructor(private readonly reportsService: LogisticsReportsService) {}

  @Query(() => LogisticsSummaryType, { name: "logisticsSummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Query(() => [ShipmentsByStatusType], { name: "shipmentsByStatus" })
  byStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.byStatus(user.companyId);
  }
}

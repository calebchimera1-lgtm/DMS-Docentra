import { Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { FleetReportsService } from "./fleet-reports.service";
import { FleetSummaryType, VehiclesByStatusType } from "./graphql/fleet-summary.type";

@Resolver()
@RequirePermissions(PERMISSIONS.FLEET_READ)
export class FleetReportsResolver {
  constructor(private readonly reportsService: FleetReportsService) {}

  @Query(() => FleetSummaryType, { name: "fleetSummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Query(() => [VehiclesByStatusType], { name: "vehiclesByStatus" })
  byStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.byStatus(user.companyId);
  }
}

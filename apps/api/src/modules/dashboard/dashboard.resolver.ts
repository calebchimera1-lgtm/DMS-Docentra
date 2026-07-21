import { Query, Resolver } from "@nestjs/graphql";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../auth/interfaces/jwt-payload.interface";
import { DashboardService } from "./dashboard.service";
import { DashboardSummaryType } from "./graphql/dashboard-summary.type";

@Resolver()
export class DashboardResolver {
  constructor(private readonly dashboardService: DashboardService) {}

  @Query(() => DashboardSummaryType, { name: "dashboardSummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getSummary(user.companyId);
  }
}

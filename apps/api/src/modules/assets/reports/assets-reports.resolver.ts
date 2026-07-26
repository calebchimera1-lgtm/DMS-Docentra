import { Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { AssetsReportsService } from "./assets-reports.service";
import { AssetsByCategoryType, AssetsSummaryType } from "./graphql/assets-summary.type";

@Resolver()
@RequirePermissions(PERMISSIONS.ASSETS_READ)
export class AssetsReportsResolver {
  constructor(private readonly reportsService: AssetsReportsService) {}

  @Query(() => AssetsSummaryType, { name: "assetsSummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Query(() => [AssetsByCategoryType], { name: "assetsByCategory" })
  byCategory(@CurrentUser() user: RequestUser) {
    return this.reportsService.byCategory(user.companyId);
  }
}

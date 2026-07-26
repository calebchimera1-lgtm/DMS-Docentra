import { Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { PurchaseReportsService } from "./purchase-reports.service";
import { PurchaseOrdersByStatusType, PurchaseSummaryType } from "./graphql/purchase-summary.type";

@Resolver()
@RequirePermissions(PERMISSIONS.PURCHASE_READ)
export class PurchaseReportsResolver {
  constructor(private readonly reportsService: PurchaseReportsService) {}

  @Query(() => PurchaseSummaryType, { name: "purchaseSummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Query(() => [PurchaseOrdersByStatusType], { name: "purchaseOrdersByStatus" })
  ordersByStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.ordersByStatus(user.companyId);
  }
}

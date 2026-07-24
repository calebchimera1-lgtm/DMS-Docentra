import { Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { InventorySummaryType } from "./graphql/inventory-summary.type";
import { InventoryReportsService } from "./inventory-reports.service";

@Resolver()
@RequirePermissions(PERMISSIONS.INVENTORY_READ)
export class InventoryReportsResolver {
  constructor(private readonly reportsService: InventoryReportsService) {}

  @Query(() => InventorySummaryType, { name: "inventorySummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }
}

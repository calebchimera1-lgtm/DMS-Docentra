import { Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { PosReportsService } from "./pos-reports.service";
import { PosSalesByPaymentMethodType, PosSummaryType } from "./graphql/pos-summary.type";

@Resolver()
@RequirePermissions(PERMISSIONS.POS_READ)
export class PosReportsResolver {
  constructor(private readonly reportsService: PosReportsService) {}

  @Query(() => PosSummaryType, { name: "posSummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Query(() => [PosSalesByPaymentMethodType], { name: "posSalesByPaymentMethod" })
  byPaymentMethod(@CurrentUser() user: RequestUser) {
    return this.reportsService.byPaymentMethod(user.companyId);
  }
}

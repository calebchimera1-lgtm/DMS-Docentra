import { Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ContractsReportsService } from "./contracts-reports.service";
import { ContractsByStatusType, ContractsSummaryType } from "./graphql/contracts-summary.type";

@Resolver()
@RequirePermissions(PERMISSIONS.CONTRACTS_READ)
export class ContractsReportsResolver {
  constructor(private readonly reportsService: ContractsReportsService) {}

  @Query(() => ContractsSummaryType, { name: "contractsSummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Query(() => [ContractsByStatusType], { name: "contractsByStatus" })
  byStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.byStatus(user.companyId);
  }
}

import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { CrmDealStage } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { DealsService } from "./deals.service";
import { toCrmDealType } from "./graphql/deal.mapper";
import { CrmDealType } from "./graphql/deal.type";
import { ListDealsArgs, PaginatedCrmDeals } from "./graphql/list-deals.args";

@Resolver(() => CrmDealType)
@RequirePermissions(PERMISSIONS.CRM_READ)
export class DealsResolver {
  constructor(private readonly dealsService: DealsService) {}

  @Query(() => PaginatedCrmDeals, { name: "crmDeals" })
  async crmDeals(@CurrentUser() user: RequestUser, @Args() args: ListDealsArgs): Promise<PaginatedCrmDeals> {
    const result = await this.dealsService.list(user.companyId, {
      ...args,
      stage: args.stage as CrmDealStage | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toCrmDealType>[0][]).map(toCrmDealType),
    };
  }

  @Query(() => CrmDealType, { name: "crmDeal" })
  async crmDeal(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<CrmDealType> {
    const deal = await this.dealsService.findOne(user.companyId, id);
    return toCrmDealType(deal);
  }
}

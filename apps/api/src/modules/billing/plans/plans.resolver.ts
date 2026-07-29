import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { BillingInterval } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ListPlansArgs, PaginatedSubscriptionPlans } from "./graphql/list-plans.args";
import { toSubscriptionPlanItemType } from "./graphql/plan.mapper";
import { SubscriptionPlanItemType } from "./graphql/plan.type";
import { PlansService } from "./plans.service";

@Resolver(() => SubscriptionPlanItemType)
@RequirePermissions(PERMISSIONS.BILLING_READ)
export class PlansResolver {
  constructor(private readonly plansService: PlansService) {}

  @Query(() => PaginatedSubscriptionPlans, { name: "subscriptionPlans" })
  async subscriptionPlans(
    @CurrentUser() user: RequestUser,
    @Args() args: ListPlansArgs,
  ): Promise<PaginatedSubscriptionPlans> {
    const result = await this.plansService.list(user.companyId, {
      ...args,
      billingInterval: args.billingInterval as BillingInterval | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toSubscriptionPlanItemType>[0][]).map(toSubscriptionPlanItemType),
    };
  }

  @Query(() => SubscriptionPlanItemType, { name: "subscriptionPlan" })
  async subscriptionPlan(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<SubscriptionPlanItemType> {
    const plan = await this.plansService.findOne(user.companyId, id);
    return toSubscriptionPlanItemType(plan);
  }
}

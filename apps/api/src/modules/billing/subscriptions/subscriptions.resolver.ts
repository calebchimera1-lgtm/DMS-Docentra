import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { SubscriptionStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ListSubscriptionsArgs, PaginatedSubscriptions } from "./graphql/list-subscriptions.args";
import { toSubscriptionItemType } from "./graphql/subscription.mapper";
import { SubscriptionItemType } from "./graphql/subscription.type";
import { SubscriptionsService } from "./subscriptions.service";

@Resolver(() => SubscriptionItemType)
@RequirePermissions(PERMISSIONS.BILLING_READ)
export class SubscriptionsResolver {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Query(() => PaginatedSubscriptions, { name: "subscriptions" })
  async subscriptions(
    @CurrentUser() user: RequestUser,
    @Args() args: ListSubscriptionsArgs,
  ): Promise<PaginatedSubscriptions> {
    const result = await this.subscriptionsService.list(user.companyId, {
      ...args,
      status: args.status as SubscriptionStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toSubscriptionItemType>[0][]).map(toSubscriptionItemType),
    };
  }

  @Query(() => SubscriptionItemType, { name: "subscription" })
  async subscription(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<SubscriptionItemType> {
    const subscription = await this.subscriptionsService.findOne(user.companyId, id);
    return toSubscriptionItemType(subscription);
  }
}

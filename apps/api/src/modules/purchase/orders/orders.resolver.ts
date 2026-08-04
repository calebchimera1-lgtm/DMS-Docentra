import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { PurchaseOrderStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { PurchaseOrdersService } from "./orders.service";
import { ListPurchaseOrdersArgs, PaginatedPurchaseOrders } from "./graphql/list-purchase-orders.args";
import { toPurchaseOrderItemType } from "./graphql/purchase-order.mapper";
import { PurchaseOrderItemType } from "./graphql/purchase-order.type";

@Resolver(() => PurchaseOrderItemType)
@RequirePermissions(PERMISSIONS.PURCHASE_READ)
export class PurchaseOrdersResolver {
  constructor(private readonly ordersService: PurchaseOrdersService) {}

  @Query(() => PaginatedPurchaseOrders, { name: "purchaseOrders" })
  async purchaseOrders(
    @CurrentUser() user: RequestUser,
    @Args() args: ListPurchaseOrdersArgs,
  ): Promise<PaginatedPurchaseOrders> {
    const result = await this.ordersService.list(user.companyId, {
      ...args,
      status: args.status as PurchaseOrderStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toPurchaseOrderItemType>[0][]).map(toPurchaseOrderItemType),
    };
  }

  @Query(() => PurchaseOrderItemType, { name: "purchaseOrder" })
  async purchaseOrder(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<PurchaseOrderItemType> {
    const order = await this.ordersService.findOne(user.companyId, id);
    return toPurchaseOrderItemType(order);
  }
}

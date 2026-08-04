import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { SalesOrderStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ListOrdersArgs, PaginatedSalesOrders } from "./graphql/list-orders.args";
import { toSalesOrderType } from "./graphql/order.mapper";
import { SalesOrderType } from "./graphql/order.type";
import { OrdersService } from "./orders.service";

@Resolver(() => SalesOrderType)
@RequirePermissions(PERMISSIONS.SALES_READ)
export class OrdersResolver {
  constructor(private readonly ordersService: OrdersService) {}

  @Query(() => PaginatedSalesOrders, { name: "salesOrders" })
  async salesOrders(
    @CurrentUser() user: RequestUser,
    @Args() args: ListOrdersArgs,
  ): Promise<PaginatedSalesOrders> {
    const result = await this.ordersService.list(user.companyId, {
      ...args,
      status: args.status as SalesOrderStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toSalesOrderType>[0][]).map(toSalesOrderType),
    };
  }

  @Query(() => SalesOrderType, { name: "salesOrder" })
  async salesOrder(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<SalesOrderType> {
    const order = await this.ordersService.findOne(user.companyId, id);
    return toSalesOrderType(order);
  }
}

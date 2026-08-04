import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ListStockArgs, PaginatedStockItems } from "./graphql/list-stock.args";
import { toStockItemType } from "./graphql/stock-item.mapper";
import { StockItemType } from "./graphql/stock-item.type";
import { StockService } from "./stock.service";

@Resolver(() => StockItemType)
@RequirePermissions(PERMISSIONS.INVENTORY_READ)
export class StockResolver {
  constructor(private readonly stockService: StockService) {}

  @Query(() => PaginatedStockItems, { name: "stockItems" })
  async stockItems(
    @CurrentUser() user: RequestUser,
    @Args() args: ListStockArgs,
  ): Promise<PaginatedStockItems> {
    const result = await this.stockService.list(user.companyId, args);
    return {
      ...result,
      items: (result.items as Parameters<typeof toStockItemType>[0][]).map(toStockItemType),
    };
  }

  @Query(() => StockItemType, { name: "stockItem" })
  async stockItem(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<StockItemType> {
    const item = await this.stockService.findOne(user.companyId, id);
    return toStockItemType(item);
  }
}

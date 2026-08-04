import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { PaymentMethod, PosSaleStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ListSalesArgs, PaginatedPosSales } from "./graphql/list-sales.args";
import { toSaleItemType } from "./graphql/sale.mapper";
import { PosSaleItemType } from "./graphql/sale.type";
import { SalesService } from "./sales.service";

@Resolver(() => PosSaleItemType)
@RequirePermissions(PERMISSIONS.POS_READ)
export class SalesResolver {
  constructor(private readonly salesService: SalesService) {}

  @Query(() => PaginatedPosSales, { name: "posSales" })
  async posSales(@CurrentUser() user: RequestUser, @Args() args: ListSalesArgs): Promise<PaginatedPosSales> {
    const result = await this.salesService.list(user.companyId, {
      ...args,
      status: args.status as PosSaleStatus | undefined,
      paymentMethod: args.paymentMethod as PaymentMethod | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toSaleItemType>[0][]).map(toSaleItemType),
    };
  }

  @Query(() => PosSaleItemType, { name: "posSale" })
  async posSale(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<PosSaleItemType> {
    const sale = await this.salesService.findOne(user.companyId, id);
    return toSaleItemType(sale);
  }
}

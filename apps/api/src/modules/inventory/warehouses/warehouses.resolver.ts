import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ListWarehousesArgs, PaginatedWarehouses } from "./graphql/list-warehouses.args";
import { toWarehouseType } from "./graphql/warehouse.mapper";
import { WarehouseType } from "./graphql/warehouse.type";
import { WarehousesService } from "./warehouses.service";

@Resolver(() => WarehouseType)
@RequirePermissions(PERMISSIONS.INVENTORY_READ)
export class WarehousesResolver {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Query(() => PaginatedWarehouses, { name: "warehouses" })
  async warehouses(
    @CurrentUser() user: RequestUser,
    @Args() args: ListWarehousesArgs,
  ): Promise<PaginatedWarehouses> {
    const result = await this.warehousesService.list(user.companyId, args);
    return {
      ...result,
      items: (result.items as Parameters<typeof toWarehouseType>[0][]).map(toWarehouseType),
    };
  }

  @Query(() => WarehouseType, { name: "warehouse" })
  async warehouse(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<WarehouseType> {
    const warehouse = await this.warehousesService.findOne(user.companyId, id);
    return toWarehouseType(warehouse);
  }
}

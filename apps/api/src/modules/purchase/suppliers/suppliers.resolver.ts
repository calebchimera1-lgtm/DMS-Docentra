import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { SuppliersService } from "./suppliers.service";
import { ListSuppliersArgs, PaginatedSuppliers } from "./graphql/list-suppliers.args";
import { toSupplierItemType } from "./graphql/supplier.mapper";
import { SupplierItemType } from "./graphql/supplier.type";

@Resolver(() => SupplierItemType)
@RequirePermissions(PERMISSIONS.PURCHASE_READ)
export class SuppliersResolver {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Query(() => PaginatedSuppliers, { name: "suppliers" })
  async suppliers(
    @CurrentUser() user: RequestUser,
    @Args() args: ListSuppliersArgs,
  ): Promise<PaginatedSuppliers> {
    const result = await this.suppliersService.list(user.companyId, args);
    return {
      ...result,
      items: (result.items as Parameters<typeof toSupplierItemType>[0][]).map(toSupplierItemType),
    };
  }

  @Query(() => SupplierItemType, { name: "supplier" })
  async supplier(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<SupplierItemType> {
    const supplier = await this.suppliersService.findOne(user.companyId, id);
    return toSupplierItemType(supplier);
  }
}

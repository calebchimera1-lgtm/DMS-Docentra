import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ListProductsArgs, PaginatedProducts } from "./graphql/list-products.args";
import { ProductType } from "./graphql/product.type";
import { ProductsService } from "./products.service";

@Resolver(() => ProductType)
@RequirePermissions(PERMISSIONS.SALES_READ)
export class ProductsResolver {
  constructor(private readonly productsService: ProductsService) {}

  @Query(() => PaginatedProducts, { name: "products" })
  async products(@CurrentUser() user: RequestUser, @Args() args: ListProductsArgs): Promise<PaginatedProducts> {
    return (await this.productsService.list(user.companyId, args)) as PaginatedProducts;
  }

  @Query(() => ProductType, { name: "product" })
  async product(@CurrentUser() user: RequestUser, @Args("id", { type: () => ID }) id: string) {
    return this.productsService.findOne(user.companyId, id);
  }
}

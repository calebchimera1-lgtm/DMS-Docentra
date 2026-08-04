import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { AssetCategoriesService } from "./asset-categories.service";
import { ListAssetCategoriesArgs, PaginatedAssetCategories } from "./graphql/list-asset-categories.args";
import { toAssetCategoryItemType } from "./graphql/asset-category.mapper";
import { AssetCategoryItemType } from "./graphql/asset-category.type";

@Resolver(() => AssetCategoryItemType)
@RequirePermissions(PERMISSIONS.ASSETS_READ)
export class AssetCategoriesResolver {
  constructor(private readonly assetCategoriesService: AssetCategoriesService) {}

  @Query(() => PaginatedAssetCategories, { name: "assetCategories" })
  async assetCategories(
    @CurrentUser() user: RequestUser,
    @Args() args: ListAssetCategoriesArgs,
  ): Promise<PaginatedAssetCategories> {
    const result = await this.assetCategoriesService.list(user.companyId, args);
    return {
      ...result,
      items: (result.items as Parameters<typeof toAssetCategoryItemType>[0][]).map(toAssetCategoryItemType),
    };
  }

  @Query(() => AssetCategoryItemType, { name: "assetCategory" })
  async assetCategory(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<AssetCategoryItemType> {
    const category = await this.assetCategoriesService.findOne(user.companyId, id);
    return toAssetCategoryItemType(category);
  }
}

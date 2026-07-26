import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { AssetStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { AssetsService } from "./assets.service";
import { ListAssetsArgs, PaginatedAssets } from "./graphql/list-assets.args";
import { toAssetItemType } from "./graphql/asset.mapper";
import { AssetItemType } from "./graphql/asset.type";

@Resolver(() => AssetItemType)
@RequirePermissions(PERMISSIONS.ASSETS_READ)
export class AssetsResolver {
  constructor(private readonly assetsService: AssetsService) {}

  @Query(() => PaginatedAssets, { name: "assets" })
  async assets(@CurrentUser() user: RequestUser, @Args() args: ListAssetsArgs): Promise<PaginatedAssets> {
    const result = await this.assetsService.list(user.companyId, {
      ...args,
      status: args.status as AssetStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toAssetItemType>[0][]).map(toAssetItemType),
    };
  }

  @Query(() => AssetItemType, { name: "asset" })
  async asset(@CurrentUser() user: RequestUser, @Args("id", { type: () => ID }) id: string): Promise<AssetItemType> {
    const asset = await this.assetsService.findOne(user.companyId, id);
    return toAssetItemType(asset);
  }
}

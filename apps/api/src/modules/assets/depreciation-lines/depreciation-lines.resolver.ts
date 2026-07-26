import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { DepreciationLinesService } from "./depreciation-lines.service";
import { ListDepreciationLinesArgs, PaginatedDepreciationLines } from "./graphql/list-depreciation-lines.args";
import { toDepreciationLineItemType } from "./graphql/depreciation-line.mapper";
import { DepreciationLineItemType } from "./graphql/depreciation-line.type";

@Resolver(() => DepreciationLineItemType)
@RequirePermissions(PERMISSIONS.ASSETS_READ)
export class DepreciationLinesResolver {
  constructor(private readonly depreciationLinesService: DepreciationLinesService) {}

  @Query(() => PaginatedDepreciationLines, { name: "depreciationLines" })
  async depreciationLines(
    @CurrentUser() user: RequestUser,
    @Args() args: ListDepreciationLinesArgs,
  ): Promise<PaginatedDepreciationLines> {
    const result = await this.depreciationLinesService.list(user.companyId, args);
    return {
      ...result,
      items: (result.items as Parameters<typeof toDepreciationLineItemType>[0][]).map(toDepreciationLineItemType),
    };
  }

  @Query(() => DepreciationLineItemType, { name: "depreciationLine" })
  async depreciationLine(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<DepreciationLineItemType> {
    const line = await this.depreciationLinesService.findOne(user.companyId, id);
    return toDepreciationLineItemType(line);
  }
}

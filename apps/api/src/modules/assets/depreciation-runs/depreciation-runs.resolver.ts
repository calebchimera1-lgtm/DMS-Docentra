import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { DepreciationRunStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { DepreciationRunsService } from "./depreciation-runs.service";
import { ListDepreciationRunsArgs, PaginatedDepreciationRuns } from "./graphql/list-depreciation-runs.args";
import { toDepreciationRunItemType } from "./graphql/depreciation-run.mapper";
import { DepreciationRunItemType } from "./graphql/depreciation-run.type";

@Resolver(() => DepreciationRunItemType)
@RequirePermissions(PERMISSIONS.ASSETS_READ)
export class DepreciationRunsResolver {
  constructor(private readonly depreciationRunsService: DepreciationRunsService) {}

  @Query(() => PaginatedDepreciationRuns, { name: "depreciationRuns" })
  async depreciationRuns(
    @CurrentUser() user: RequestUser,
    @Args() args: ListDepreciationRunsArgs,
  ): Promise<PaginatedDepreciationRuns> {
    const result = await this.depreciationRunsService.list(user.companyId, {
      ...args,
      status: args.status as DepreciationRunStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toDepreciationRunItemType>[0][]).map(toDepreciationRunItemType),
    };
  }

  @Query(() => DepreciationRunItemType, { name: "depreciationRun" })
  async depreciationRun(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<DepreciationRunItemType> {
    const run = await this.depreciationRunsService.findOne(user.companyId, id);
    return toDepreciationRunItemType(run);
  }
}

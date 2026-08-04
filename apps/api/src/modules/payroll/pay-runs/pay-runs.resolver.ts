import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { PayRunStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { PayRunsService } from "./pay-runs.service";
import { ListPayRunsArgs, PaginatedPayRuns } from "./graphql/list-pay-runs.args";
import { toPayRunItemType } from "./graphql/pay-run.mapper";
import { PayRunItemType } from "./graphql/pay-run.type";

@Resolver(() => PayRunItemType)
@RequirePermissions(PERMISSIONS.PAYROLL_READ)
export class PayRunsResolver {
  constructor(private readonly payRunsService: PayRunsService) {}

  @Query(() => PaginatedPayRuns, { name: "payRuns" })
  async payRuns(
    @CurrentUser() user: RequestUser,
    @Args() args: ListPayRunsArgs,
  ): Promise<PaginatedPayRuns> {
    const result = await this.payRunsService.list(user.companyId, {
      ...args,
      status: args.status as PayRunStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toPayRunItemType>[0][]).map(toPayRunItemType),
    };
  }

  @Query(() => PayRunItemType, { name: "payRun" })
  async payRun(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<PayRunItemType> {
    const payRun = await this.payRunsService.findOne(user.companyId, id);
    return toPayRunItemType(payRun);
  }
}

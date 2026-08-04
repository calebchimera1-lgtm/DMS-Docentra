import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { ExpenseClaimStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ExpenseClaimsService } from "./expense-claims.service";
import { ListExpenseClaimsArgs, PaginatedExpenseClaims } from "./graphql/list-expense-claims.args";
import { toExpenseClaimItemType } from "./graphql/expense-claim.mapper";
import { ExpenseClaimItemType } from "./graphql/expense-claim.type";

@Resolver(() => ExpenseClaimItemType)
@RequirePermissions(PERMISSIONS.EXPENSES_READ)
export class ExpenseClaimsResolver {
  constructor(private readonly expenseClaimsService: ExpenseClaimsService) {}

  @Query(() => PaginatedExpenseClaims, { name: "expenseClaims" })
  async expenseClaims(
    @CurrentUser() user: RequestUser,
    @Args() args: ListExpenseClaimsArgs,
  ): Promise<PaginatedExpenseClaims> {
    const result = await this.expenseClaimsService.list(user.companyId, {
      ...args,
      status: args.status as ExpenseClaimStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toExpenseClaimItemType>[0][]).map(toExpenseClaimItemType),
    };
  }

  @Query(() => ExpenseClaimItemType, { name: "expenseClaim" })
  async expenseClaim(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ExpenseClaimItemType> {
    const claim = await this.expenseClaimsService.findOne(user.companyId, id);
    return toExpenseClaimItemType(claim);
  }
}

import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ExpenseCategoriesService } from "./expense-categories.service";
import { ListExpenseCategoriesArgs, PaginatedExpenseCategories } from "./graphql/list-expense-categories.args";
import { toExpenseCategoryItemType } from "./graphql/expense-category.mapper";
import { ExpenseCategoryItemType } from "./graphql/expense-category.type";

@Resolver(() => ExpenseCategoryItemType)
@RequirePermissions(PERMISSIONS.EXPENSES_READ)
export class ExpenseCategoriesResolver {
  constructor(private readonly expenseCategoriesService: ExpenseCategoriesService) {}

  @Query(() => PaginatedExpenseCategories, { name: "expenseCategories" })
  async expenseCategories(
    @CurrentUser() user: RequestUser,
    @Args() args: ListExpenseCategoriesArgs,
  ): Promise<PaginatedExpenseCategories> {
    const result = await this.expenseCategoriesService.list(user.companyId, args);
    return {
      ...result,
      items: (result.items as Parameters<typeof toExpenseCategoryItemType>[0][]).map(toExpenseCategoryItemType),
    };
  }

  @Query(() => ExpenseCategoryItemType, { name: "expenseCategory" })
  async expenseCategory(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ExpenseCategoryItemType> {
    const category = await this.expenseCategoriesService.findOne(user.companyId, id);
    return toExpenseCategoryItemType(category);
  }
}

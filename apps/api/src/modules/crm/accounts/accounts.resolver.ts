import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { AccountsService } from "./accounts.service";
import { toCrmAccountType } from "./graphql/account.mapper";
import { CrmAccountType } from "./graphql/account.type";
import { ListAccountsArgs, PaginatedCrmAccounts } from "./graphql/list-accounts.args";

@Resolver(() => CrmAccountType)
@RequirePermissions(PERMISSIONS.CRM_READ)
export class AccountsResolver {
  constructor(private readonly accountsService: AccountsService) {}

  @Query(() => PaginatedCrmAccounts, { name: "crmAccounts" })
  async crmAccounts(
    @CurrentUser() user: RequestUser,
    @Args() args: ListAccountsArgs,
  ): Promise<PaginatedCrmAccounts> {
    const result = await this.accountsService.list(user.companyId, args);
    return {
      ...result,
      items: (result.items as Parameters<typeof toCrmAccountType>[0][]).map(toCrmAccountType),
    };
  }

  @Query(() => CrmAccountType, { name: "crmAccount" })
  async crmAccount(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<CrmAccountType> {
    const account = await this.accountsService.findOne(user.companyId, id);
    return toCrmAccountType(account);
  }
}

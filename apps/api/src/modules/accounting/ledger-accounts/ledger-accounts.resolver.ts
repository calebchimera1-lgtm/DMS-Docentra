import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { LedgerAccountType as PrismaLedgerAccountType } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { LedgerAccountsService } from "./ledger-accounts.service";
import { ListLedgerAccountsArgs, PaginatedLedgerAccounts } from "./graphql/list-ledger-accounts.args";
import { toLedgerAccountItemType } from "./graphql/ledger-account.mapper";
import { LedgerAccountItemType } from "./graphql/ledger-account.type";

@Resolver(() => LedgerAccountItemType)
@RequirePermissions(PERMISSIONS.ACCOUNTING_READ)
export class LedgerAccountsResolver {
  constructor(private readonly ledgerAccountsService: LedgerAccountsService) {}

  @Query(() => PaginatedLedgerAccounts, { name: "ledgerAccounts" })
  async ledgerAccounts(
    @CurrentUser() user: RequestUser,
    @Args() args: ListLedgerAccountsArgs,
  ): Promise<PaginatedLedgerAccounts> {
    const result = await this.ledgerAccountsService.list(user.companyId, {
      ...args,
      type: args.type as PrismaLedgerAccountType | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toLedgerAccountItemType>[0][]).map(toLedgerAccountItemType),
    };
  }

  @Query(() => LedgerAccountItemType, { name: "ledgerAccount" })
  async ledgerAccount(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<LedgerAccountItemType> {
    const account = await this.ledgerAccountsService.findOne(user.companyId, id);
    return toLedgerAccountItemType(account);
  }
}

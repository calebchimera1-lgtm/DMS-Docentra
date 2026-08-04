import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { QuoteStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ListQuotesArgs, PaginatedQuotes } from "./graphql/list-quotes.args";
import { toQuoteType } from "./graphql/quote.mapper";
import { QuoteType } from "./graphql/quote.type";
import { QuotesService } from "./quotes.service";

@Resolver(() => QuoteType)
@RequirePermissions(PERMISSIONS.SALES_READ)
export class QuotesResolver {
  constructor(private readonly quotesService: QuotesService) {}

  @Query(() => PaginatedQuotes, { name: "quotes" })
  async quotes(@CurrentUser() user: RequestUser, @Args() args: ListQuotesArgs): Promise<PaginatedQuotes> {
    const result = await this.quotesService.list(user.companyId, {
      ...args,
      status: args.status as QuoteStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toQuoteType>[0][]).map(toQuoteType),
    };
  }

  @Query(() => QuoteType, { name: "quote" })
  async quote(@CurrentUser() user: RequestUser, @Args("id", { type: () => ID }) id: string): Promise<QuoteType> {
    const quote = await this.quotesService.findOne(user.companyId, id);
    return toQuoteType(quote);
  }
}

import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { JournalEntryStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { JournalEntriesService } from "./journal-entries.service";
import { toJournalEntryType } from "./graphql/journal-entry.mapper";
import { JournalEntryType } from "./graphql/journal-entry.type";
import { ListJournalEntriesArgs, PaginatedJournalEntries } from "./graphql/list-journal-entries.args";

@Resolver(() => JournalEntryType)
@RequirePermissions(PERMISSIONS.ACCOUNTING_READ)
export class JournalEntriesResolver {
  constructor(private readonly journalEntriesService: JournalEntriesService) {}

  @Query(() => PaginatedJournalEntries, { name: "journalEntries" })
  async journalEntries(
    @CurrentUser() user: RequestUser,
    @Args() args: ListJournalEntriesArgs,
  ): Promise<PaginatedJournalEntries> {
    const result = await this.journalEntriesService.list(user.companyId, {
      ...args,
      status: args.status as JournalEntryStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toJournalEntryType>[0][]).map(toJournalEntryType),
    };
  }

  @Query(() => JournalEntryType, { name: "journalEntry" })
  async journalEntry(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<JournalEntryType> {
    const entry = await this.journalEntriesService.findOne(user.companyId, id);
    return toJournalEntryType(entry);
  }
}

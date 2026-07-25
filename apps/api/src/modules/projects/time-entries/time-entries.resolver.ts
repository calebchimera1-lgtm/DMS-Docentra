import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { TimeEntriesService } from "./time-entries.service";
import { ListTimeEntriesArgs, PaginatedTimeEntries } from "./graphql/list-time-entries.args";
import { toTimeEntryItemType } from "./graphql/time-entry.mapper";
import { TimeEntryItemType } from "./graphql/time-entry.type";

@Resolver(() => TimeEntryItemType)
@RequirePermissions(PERMISSIONS.PROJECTS_READ)
export class TimeEntriesResolver {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Query(() => PaginatedTimeEntries, { name: "timeEntries" })
  async timeEntries(
    @CurrentUser() user: RequestUser,
    @Args() args: ListTimeEntriesArgs,
  ): Promise<PaginatedTimeEntries> {
    const result = await this.timeEntriesService.list(user.companyId, args);
    return {
      ...result,
      items: (result.items as Parameters<typeof toTimeEntryItemType>[0][]).map(toTimeEntryItemType),
    };
  }

  @Query(() => TimeEntryItemType, { name: "timeEntry" })
  async timeEntry(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<TimeEntryItemType> {
    const entry = await this.timeEntriesService.findOne(user.companyId, id);
    return toTimeEntryItemType(entry);
  }
}

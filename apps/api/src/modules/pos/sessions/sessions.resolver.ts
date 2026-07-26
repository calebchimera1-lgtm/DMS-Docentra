import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { PosSessionStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ListSessionsArgs, PaginatedPosSessions } from "./graphql/list-sessions.args";
import { toSessionItemType } from "./graphql/session.mapper";
import { PosSessionItemType } from "./graphql/session.type";
import { SessionsService } from "./sessions.service";

@Resolver(() => PosSessionItemType)
@RequirePermissions(PERMISSIONS.POS_READ)
export class SessionsResolver {
  constructor(private readonly sessionsService: SessionsService) {}

  @Query(() => PaginatedPosSessions, { name: "posSessions" })
  async posSessions(
    @CurrentUser() user: RequestUser,
    @Args() args: ListSessionsArgs,
  ): Promise<PaginatedPosSessions> {
    const result = await this.sessionsService.list(user.companyId, {
      ...args,
      status: args.status as PosSessionStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toSessionItemType>[0][]).map(toSessionItemType),
    };
  }

  @Query(() => PosSessionItemType, { name: "posSession" })
  async posSession(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<PosSessionItemType> {
    const session = await this.sessionsService.findOne(user.companyId, id);
    return toSessionItemType(session);
  }
}

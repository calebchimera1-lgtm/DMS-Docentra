import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../auth/interfaces/jwt-payload.interface";
import { UsersService } from "./users.service";
import { ListUsersArgs, PaginatedUsers } from "./graphql/list-users.args";
import { toUserType } from "./graphql/user.mapper";
import { UserType } from "./graphql/user.type";

@Resolver(() => UserType)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => UserType, { name: "me", description: "The current user's profile" })
  async me(@CurrentUser() user: RequestUser): Promise<UserType> {
    const profile = await this.usersService.findOne(user.companyId, user.id);
    return toUserType(profile);
  }

  @Query(() => PaginatedUsers, { name: "users" })
  @RequirePermissions(PERMISSIONS.USERS_READ)
  async users(@CurrentUser() user: RequestUser, @Args() args: ListUsersArgs): Promise<PaginatedUsers> {
    const result = await this.usersService.list(user.companyId, args);
    return {
      ...result,
      items: (result.items as Parameters<typeof toUserType>[0][]).map(toUserType),
    };
  }

  @Query(() => UserType, { name: "user" })
  @RequirePermissions(PERMISSIONS.USERS_READ)
  async user(@CurrentUser() user: RequestUser, @Args("id", { type: () => ID }) id: string): Promise<UserType> {
    const profile = await this.usersService.findOne(user.companyId, id);
    return toUserType(profile);
  }
}

import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../auth/interfaces/jwt-payload.interface";
import { toRoleType } from "./graphql/role.mapper";
import { RoleType } from "./graphql/role.type";
import { RolesService } from "./roles.service";

@Resolver(() => RoleType)
@RequirePermissions(PERMISSIONS.ROLES_MANAGE)
export class RolesResolver {
  constructor(private readonly rolesService: RolesService) {}

  @Query(() => [RoleType], { name: "roles" })
  async roles(@CurrentUser() user: RequestUser): Promise<RoleType[]> {
    const roles = await this.rolesService.list(user.companyId);
    return roles.map(toRoleType);
  }

  @Query(() => RoleType, { name: "role" })
  async role(@CurrentUser() user: RequestUser, @Args("id", { type: () => ID }) id: string): Promise<RoleType> {
    const role = await this.rolesService.findOne(user.companyId, id);
    return toRoleType(role);
  }
}

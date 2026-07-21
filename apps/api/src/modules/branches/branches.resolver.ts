import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../auth/interfaces/jwt-payload.interface";
import { BranchesService } from "./branches.service";
import { BranchType } from "./graphql/branch.type";

@Resolver(() => BranchType)
@RequirePermissions(PERMISSIONS.BRANCHES_MANAGE)
export class BranchesResolver {
  constructor(private readonly branchesService: BranchesService) {}

  @Query(() => [BranchType], { name: "branches" })
  branches(@CurrentUser() user: RequestUser) {
    return this.branchesService.list(user.companyId);
  }

  @Query(() => BranchType, { name: "branch" })
  branch(@CurrentUser() user: RequestUser, @Args("id", { type: () => ID }) id: string) {
    return this.branchesService.findOne(user.companyId, id);
  }
}

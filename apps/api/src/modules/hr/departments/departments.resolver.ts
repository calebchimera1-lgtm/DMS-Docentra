import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { DepartmentsService } from "./departments.service";
import { ListDepartmentsArgs, PaginatedDepartments } from "./graphql/list-departments.args";
import { toDepartmentItemType } from "./graphql/department.mapper";
import { DepartmentItemType } from "./graphql/department.type";

@Resolver(() => DepartmentItemType)
@RequirePermissions(PERMISSIONS.HR_READ)
export class DepartmentsResolver {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Query(() => PaginatedDepartments, { name: "departments" })
  async departments(
    @CurrentUser() user: RequestUser,
    @Args() args: ListDepartmentsArgs,
  ): Promise<PaginatedDepartments> {
    const result = await this.departmentsService.list(user.companyId, args);
    return {
      ...result,
      items: (result.items as Parameters<typeof toDepartmentItemType>[0][]).map(toDepartmentItemType),
    };
  }

  @Query(() => DepartmentItemType, { name: "department" })
  async department(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<DepartmentItemType> {
    const department = await this.departmentsService.findOne(user.companyId, id);
    return toDepartmentItemType(department);
  }
}

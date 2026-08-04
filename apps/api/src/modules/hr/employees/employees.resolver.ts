import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { EmployeeStatus, EmploymentType } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { EmployeesService } from "./employees.service";
import { ListEmployeesArgs, PaginatedEmployees } from "./graphql/list-employees.args";
import { toEmployeeItemType } from "./graphql/employee.mapper";
import { EmployeeItemType } from "./graphql/employee.type";

@Resolver(() => EmployeeItemType)
@RequirePermissions(PERMISSIONS.HR_READ)
export class EmployeesResolver {
  constructor(private readonly employeesService: EmployeesService) {}

  @Query(() => PaginatedEmployees, { name: "employees" })
  async employees(
    @CurrentUser() user: RequestUser,
    @Args() args: ListEmployeesArgs,
  ): Promise<PaginatedEmployees> {
    const result = await this.employeesService.list(user.companyId, {
      ...args,
      status: args.status as EmployeeStatus | undefined,
      employmentType: args.employmentType as EmploymentType | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toEmployeeItemType>[0][]).map(toEmployeeItemType),
    };
  }

  @Query(() => EmployeeItemType, { name: "employee" })
  async employee(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<EmployeeItemType> {
    const employee = await this.employeesService.findOne(user.companyId, id);
    return toEmployeeItemType(employee);
  }
}

import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { SalaryComponentType as PrismaSalaryComponentType } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { SalaryComponentsService } from "./salary-components.service";
import { ListSalaryComponentsArgs, PaginatedSalaryComponents } from "./graphql/list-salary-components.args";
import { toSalaryComponentItemType } from "./graphql/salary-component.mapper";
import { SalaryComponentItemType } from "./graphql/salary-component.type";

@Resolver(() => SalaryComponentItemType)
@RequirePermissions(PERMISSIONS.PAYROLL_READ)
export class SalaryComponentsResolver {
  constructor(private readonly salaryComponentsService: SalaryComponentsService) {}

  @Query(() => PaginatedSalaryComponents, { name: "salaryComponents" })
  async salaryComponents(
    @CurrentUser() user: RequestUser,
    @Args() args: ListSalaryComponentsArgs,
  ): Promise<PaginatedSalaryComponents> {
    const result = await this.salaryComponentsService.list(user.companyId, {
      ...args,
      type: args.type as PrismaSalaryComponentType | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toSalaryComponentItemType>[0][]).map(toSalaryComponentItemType),
    };
  }

  @Query(() => SalaryComponentItemType, { name: "salaryComponent" })
  async salaryComponent(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<SalaryComponentItemType> {
    const component = await this.salaryComponentsService.findOne(user.companyId, id);
    return toSalaryComponentItemType(component);
  }
}

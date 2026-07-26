import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { PayslipStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { PayslipsService } from "./payslips.service";
import { ListPayslipsArgs, PaginatedPayslips } from "./graphql/list-payslips.args";
import { toPayslipItemType } from "./graphql/payslip.mapper";
import { PayslipItemType } from "./graphql/payslip.type";

@Resolver(() => PayslipItemType)
@RequirePermissions(PERMISSIONS.PAYROLL_READ)
export class PayslipsResolver {
  constructor(private readonly payslipsService: PayslipsService) {}

  @Query(() => PaginatedPayslips, { name: "payslips" })
  async payslips(
    @CurrentUser() user: RequestUser,
    @Args() args: ListPayslipsArgs,
  ): Promise<PaginatedPayslips> {
    const result = await this.payslipsService.list(user.companyId, {
      ...args,
      status: args.status as PayslipStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toPayslipItemType>[0][]).map(toPayslipItemType),
    };
  }

  @Query(() => PayslipItemType, { name: "payslip" })
  async payslip(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<PayslipItemType> {
    const payslip = await this.payslipsService.findOne(user.companyId, id);
    return toPayslipItemType(payslip);
  }
}

import { Args, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ListPaymentsArgs, PaginatedPayments } from "./graphql/list-payments.args";
import { toPaymentType } from "./graphql/payment.mapper";
import { PaymentsService } from "./payments.service";

@Resolver()
@RequirePermissions(PERMISSIONS.ACCOUNTING_READ)
export class PaymentsResolver {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Query(() => PaginatedPayments, { name: "payments" })
  async payments(@CurrentUser() user: RequestUser, @Args() args: ListPaymentsArgs): Promise<PaginatedPayments> {
    const result = await this.paymentsService.list(user.companyId, args);
    return {
      ...result,
      items: (result.items as Parameters<typeof toPaymentType>[0][]).map(toPaymentType),
    };
  }
}

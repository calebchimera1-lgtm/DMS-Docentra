import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { InvoiceStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { InvoicesService } from "./invoices.service";
import { toInvoiceType } from "./graphql/invoice.mapper";
import { InvoiceType } from "./graphql/invoice.type";
import { ListInvoicesArgs, PaginatedInvoices } from "./graphql/list-invoices.args";

@Resolver(() => InvoiceType)
@RequirePermissions(PERMISSIONS.SALES_READ)
export class InvoicesResolver {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Query(() => PaginatedInvoices, { name: "invoices" })
  async invoices(@CurrentUser() user: RequestUser, @Args() args: ListInvoicesArgs): Promise<PaginatedInvoices> {
    const result = await this.invoicesService.list(user.companyId, {
      ...args,
      status: args.status as InvoiceStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toInvoiceType>[0][]).map(toInvoiceType),
    };
  }

  @Query(() => InvoiceType, { name: "invoice" })
  async invoice(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<InvoiceType> {
    const invoice = await this.invoicesService.findOne(user.companyId, id);
    return toInvoiceType(invoice);
  }
}

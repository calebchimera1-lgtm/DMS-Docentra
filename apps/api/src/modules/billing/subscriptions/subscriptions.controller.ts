import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { BillSubscriptionDto } from "./dto/bill-subscription.dto";
import { CollectPaymentDto } from "./dto/collect-payment.dto";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { ListSubscriptionsQueryDto } from "./dto/list-subscriptions-query.dto";
import { UpdateSubscriptionDto } from "./dto/update-subscription.dto";
import { SubscriptionsService } from "./subscriptions.service";

@ApiTags("billing-subscriptions")
@ApiBearerAuth()
@Controller("billing/subscriptions")
@AuditEntity("Subscription")
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.BILLING_READ)
  @ApiOperation({ summary: "List subscriptions (paginated, filterable by status/account/plan)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListSubscriptionsQueryDto) {
    return this.subscriptionsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.BILLING_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="subscriptions.csv"')
  @ApiOperation({ summary: "Export subscriptions matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListSubscriptionsQueryDto) {
    return this.subscriptionsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.BILLING_READ)
  @ApiOperation({ summary: "Get a single subscription with its billing history" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.subscriptionsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.BILLING_WRITE)
  @ApiOperation({ summary: "Open a subscription; starts trialing when the plan has a trial" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSubscriptionDto) {
    return this.subscriptionsService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.BILLING_WRITE)
  @ApiOperation({ summary: "Change the seat quantity or note" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.subscriptionsService.update(user.companyId, id, dto);
  }

  @Post(":id/activate")
  @RequirePermissions(PERMISSIONS.BILLING_WRITE)
  @ApiOperation({ summary: "Convert a trial into a paying subscription" })
  activate(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.subscriptionsService.activate(user.companyId, id);
  }

  @Post(":id/bill")
  @RequirePermissions(PERMISSIONS.BILLING_WRITE)
  @ApiOperation({ summary: "Invoice the current period and roll the subscription forward one interval" })
  bill(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: BillSubscriptionDto) {
    return this.subscriptionsService.bill(user.companyId, user.id, id, dto);
  }

  @Post(":id/collect-payment")
  @RequirePermissions(PERMISSIONS.BILLING_WRITE)
  @ApiOperation({
    summary:
      "Attempt to collect payment for the current outstanding invoice through a PaymentProvider (\"manual\" by default — no real charge is made)",
  })
  collectPayment(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: CollectPaymentDto) {
    return this.subscriptionsService.collectPayment(user.companyId, id, dto);
  }

  @Post(":id/pause")
  @RequirePermissions(PERMISSIONS.BILLING_WRITE)
  @ApiOperation({ summary: "Pause an active subscription" })
  pause(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.subscriptionsService.pause(user.companyId, id);
  }

  @Post(":id/resume")
  @RequirePermissions(PERMISSIONS.BILLING_WRITE)
  @ApiOperation({ summary: "Resume a paused subscription" })
  resume(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.subscriptionsService.resume(user.companyId, id);
  }

  @Post(":id/cancel")
  @RequirePermissions(PERMISSIONS.BILLING_WRITE)
  @ApiOperation({ summary: "Cancel a subscription" })
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.subscriptionsService.cancel(user.companyId, id);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.BILLING_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a subscription that has never been billed" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.subscriptionsService.remove(user.companyId, id);
  }
}

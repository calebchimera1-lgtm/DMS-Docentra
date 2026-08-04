import { Body, Controller, Get, Header, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { ListPaymentsQueryDto } from "./dto/list-payments-query.dto";
import { PaymentsService } from "./payments.service";

@ApiTags("accounting-payments")
@ApiBearerAuth()
@Controller("accounting/payments")
@AuditEntity("Payment")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ACCOUNTING_READ)
  @ApiOperation({ summary: "List payments, paginated and filterable" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListPaymentsQueryDto) {
    return this.paymentsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.ACCOUNTING_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="payments.csv"')
  @ApiOperation({ summary: "Export payments matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListPaymentsQueryDto) {
    return this.paymentsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.ACCOUNTING_READ)
  @ApiOperation({ summary: "Get a single payment" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.paymentsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ACCOUNTING_WRITE)
  @ApiOperation({
    summary: "Record a payment between two ledger accounts, posting a balanced journal entry automatically",
  })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(user.companyId, user.id, dto);
  }
}

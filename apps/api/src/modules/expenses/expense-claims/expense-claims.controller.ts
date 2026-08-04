import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ApproveExpenseClaimDto } from "./dto/approve-expense-claim.dto";
import { CreateExpenseClaimDto } from "./dto/create-expense-claim.dto";
import { ListExpenseClaimsQueryDto } from "./dto/list-expense-claims-query.dto";
import { RejectExpenseClaimDto } from "./dto/reject-expense-claim.dto";
import { UpdateExpenseClaimDto } from "./dto/update-expense-claim.dto";
import { ExpenseClaimsService } from "./expense-claims.service";

@ApiTags("expenses-claims")
@ApiBearerAuth()
@Controller("expenses/claims")
@AuditEntity("ExpenseClaim")
export class ExpenseClaimsController {
  constructor(private readonly expenseClaimsService: ExpenseClaimsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EXPENSES_READ)
  @ApiOperation({ summary: "List expense claims (paginated, filterable by status/employee)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListExpenseClaimsQueryDto) {
    return this.expenseClaimsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.EXPENSES_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="expense-claims.csv"')
  @ApiOperation({ summary: "Export expense claims matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListExpenseClaimsQueryDto) {
    return this.expenseClaimsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.EXPENSES_READ)
  @ApiOperation({ summary: "Get a single expense claim" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.expenseClaimsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EXPENSES_WRITE)
  @ApiOperation({ summary: "Create a draft expense claim for an employee" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateExpenseClaimDto) {
    return this.expenseClaimsService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.EXPENSES_WRITE)
  @ApiOperation({ summary: "Update a draft expense claim" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateExpenseClaimDto) {
    return this.expenseClaimsService.update(user.companyId, id, dto);
  }

  @Post(":id/submit")
  @RequirePermissions(PERMISSIONS.EXPENSES_WRITE)
  @ApiOperation({ summary: "Submit a draft expense claim for approval" })
  submit(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.expenseClaimsService.submit(user.companyId, id);
  }

  @Post(":id/approve")
  @RequirePermissions(PERMISSIONS.EXPENSES_WRITE)
  @ApiOperation({ summary: "Approve a submitted expense claim and post it to Accounting" })
  approve(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: ApproveExpenseClaimDto) {
    return this.expenseClaimsService.approve(user.companyId, user.id, id, dto);
  }

  @Post(":id/reject")
  @RequirePermissions(PERMISSIONS.EXPENSES_WRITE)
  @ApiOperation({ summary: "Reject a submitted expense claim" })
  reject(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: RejectExpenseClaimDto) {
    return this.expenseClaimsService.reject(user.companyId, user.id, id, dto);
  }

  @Post(":id/cancel")
  @RequirePermissions(PERMISSIONS.EXPENSES_WRITE)
  @ApiOperation({ summary: "Cancel a draft or submitted expense claim" })
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.expenseClaimsService.cancel(user.companyId, id);
  }

  @Post(":id/mark-paid")
  @RequirePermissions(PERMISSIONS.EXPENSES_WRITE)
  @ApiOperation({ summary: "Mark an approved expense claim as paid" })
  markPaid(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.expenseClaimsService.markPaid(user.companyId, id);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.EXPENSES_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a draft expense claim" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.expenseClaimsService.remove(user.companyId, id);
  }
}

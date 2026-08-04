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
import { CreatePayRunDto } from "./dto/create-pay-run.dto";
import { ListPayRunsQueryDto } from "./dto/list-pay-runs-query.dto";
import { UpdatePayRunDto } from "./dto/update-pay-run.dto";
import { PayRunsService } from "./pay-runs.service";

@ApiTags("payroll-pay-runs")
@ApiBearerAuth()
@Controller("payroll/pay-runs")
@AuditEntity("PayRun")
export class PayRunsController {
  constructor(private readonly payRunsService: PayRunsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PAYROLL_READ)
  @ApiOperation({ summary: "List pay runs (paginated, filterable by status)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListPayRunsQueryDto) {
    return this.payRunsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.PAYROLL_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="pay-runs.csv"')
  @ApiOperation({ summary: "Export pay runs matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListPayRunsQueryDto) {
    return this.payRunsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.PAYROLL_READ)
  @ApiOperation({ summary: "Get a single pay run" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.payRunsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PAYROLL_WRITE)
  @ApiOperation({ summary: "Create a draft pay run for a period" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePayRunDto) {
    return this.payRunsService.create(user.companyId, user.id, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.PAYROLL_WRITE)
  @ApiOperation({ summary: "Update a draft pay run's period" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdatePayRunDto) {
    return this.payRunsService.update(user.companyId, id, dto);
  }

  @Post(":id/generate")
  @RequirePermissions(PERMISSIONS.PAYROLL_WRITE)
  @ApiOperation({ summary: "Generate payslips for every active, salaried employee" })
  generate(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.payRunsService.generate(user.companyId, id);
  }

  @Post(":id/mark-paid")
  @RequirePermissions(PERMISSIONS.PAYROLL_WRITE)
  @ApiOperation({ summary: "Mark a processed pay run (and all its payslips) as paid" })
  markPaid(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.payRunsService.markPaid(user.companyId, id);
  }

  @Post(":id/cancel")
  @RequirePermissions(PERMISSIONS.PAYROLL_WRITE)
  @ApiOperation({ summary: "Cancel a draft or processed pay run" })
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.payRunsService.cancel(user.companyId, id);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.PAYROLL_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a draft pay run" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.payRunsService.remove(user.companyId, id);
  }
}

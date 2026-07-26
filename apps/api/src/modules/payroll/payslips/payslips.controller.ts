import { Controller, Get, Header, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ListPayslipsQueryDto } from "./dto/list-payslips-query.dto";
import { PayslipsService } from "./payslips.service";

@ApiTags("payroll-payslips")
@ApiBearerAuth()
@Controller("payroll/payslips")
@RequirePermissions(PERMISSIONS.PAYROLL_READ)
export class PayslipsController {
  constructor(private readonly payslipsService: PayslipsService) {}

  @Get()
  @ApiOperation({ summary: "List payslips (paginated, filterable by pay run/employee/status)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListPayslipsQueryDto) {
    return this.payslipsService.list(user.companyId, query);
  }

  @Get("export")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="payslips.csv"')
  @ApiOperation({ summary: "Export payslips matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListPayslipsQueryDto) {
    return this.payslipsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single payslip" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.payslipsService.findOne(user.companyId, id);
  }
}

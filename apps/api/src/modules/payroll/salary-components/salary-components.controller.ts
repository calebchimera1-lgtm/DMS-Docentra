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
import { CreateSalaryComponentDto } from "./dto/create-salary-component.dto";
import { ListSalaryComponentsQueryDto } from "./dto/list-salary-components-query.dto";
import { UpdateSalaryComponentDto } from "./dto/update-salary-component.dto";
import { SalaryComponentsService } from "./salary-components.service";

@ApiTags("payroll-salary-components")
@ApiBearerAuth()
@Controller("payroll/salary-components")
@AuditEntity("SalaryComponent")
export class SalaryComponentsController {
  constructor(private readonly salaryComponentsService: SalaryComponentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PAYROLL_READ)
  @ApiOperation({ summary: "List salary components (paginated, searchable, filterable by type)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListSalaryComponentsQueryDto) {
    return this.salaryComponentsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.PAYROLL_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="salary-components.csv"')
  @ApiOperation({ summary: "Export salary components matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListSalaryComponentsQueryDto) {
    return this.salaryComponentsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.PAYROLL_READ)
  @ApiOperation({ summary: "Get a single salary component" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.salaryComponentsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PAYROLL_WRITE)
  @ApiOperation({ summary: "Create a salary component" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSalaryComponentDto) {
    return this.salaryComponentsService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.PAYROLL_WRITE)
  @ApiOperation({ summary: "Update a salary component" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateSalaryComponentDto) {
    return this.salaryComponentsService.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.PAYROLL_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a salary component" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.salaryComponentsService.remove(user.companyId, id);
  }
}

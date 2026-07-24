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
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { ListEmployeesQueryDto } from "./dto/list-employees-query.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { EmployeesService } from "./employees.service";

@ApiTags("hr-employees")
@ApiBearerAuth()
@Controller("hr/employees")
@AuditEntity("Employee")
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.HR_READ)
  @ApiOperation({ summary: "List employees (paginated, searchable, filterable)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListEmployeesQueryDto) {
    return this.employeesService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.HR_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="employees.csv"')
  @ApiOperation({ summary: "Export employees matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListEmployeesQueryDto) {
    return this.employeesService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.HR_READ)
  @ApiOperation({ summary: "Get a single employee" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.employeesService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: "Create an employee" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: "Update an employee" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(user.companyId, id, dto);
  }

  @Post(":id/terminate")
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: "Terminate an employee" })
  terminate(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.employeesService.terminate(user.companyId, id);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.HR_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an employee (must not manage other employees or a department)" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.employeesService.remove(user.companyId, id);
  }
}

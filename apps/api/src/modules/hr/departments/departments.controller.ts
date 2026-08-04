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
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { ListDepartmentsQueryDto } from "./dto/list-departments-query.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { DepartmentsService } from "./departments.service";

@ApiTags("hr-departments")
@ApiBearerAuth()
@Controller("hr/departments")
@AuditEntity("Department")
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.HR_READ)
  @ApiOperation({ summary: "List departments (paginated, searchable)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListDepartmentsQueryDto) {
    return this.departmentsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.HR_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="departments.csv"')
  @ApiOperation({ summary: "Export departments matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListDepartmentsQueryDto) {
    return this.departmentsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.HR_READ)
  @ApiOperation({ summary: "Get a single department" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.departmentsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: "Create a department" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: "Update a department" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentsService.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.HR_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a department (must have no employees assigned)" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.departmentsService.remove(user.companyId, id);
  }
}

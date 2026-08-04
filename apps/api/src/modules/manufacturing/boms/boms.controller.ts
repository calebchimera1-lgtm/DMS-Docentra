import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { BomsService } from "./boms.service";
import { CreateBomDto } from "./dto/create-bom.dto";
import { ListBomsQueryDto } from "./dto/list-boms-query.dto";
import { UpdateBomDto } from "./dto/update-bom.dto";

@ApiTags("manufacturing-boms")
@ApiBearerAuth()
@Controller("manufacturing/boms")
@AuditEntity("BillOfMaterial")
export class BomsController {
  constructor(private readonly bomsService: BomsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.MANUFACTURING_READ)
  @ApiOperation({ summary: "List bills of material (paginated, filterable by product/active)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListBomsQueryDto) {
    return this.bomsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.MANUFACTURING_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="boms.csv"')
  @ApiOperation({ summary: "Export bills of material matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListBomsQueryDto) {
    return this.bomsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.MANUFACTURING_READ)
  @ApiOperation({ summary: "Get a single bill of material with its component lines" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.bomsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.MANUFACTURING_WRITE)
  @ApiOperation({ summary: "Create a bill of material" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateBomDto) {
    return this.bomsService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.MANUFACTURING_WRITE)
  @ApiOperation({ summary: "Update a bill of material, optionally replacing its component lines" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateBomDto) {
    return this.bomsService.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.MANUFACTURING_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a bill of material" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.bomsService.remove(user.companyId, id);
  }
}

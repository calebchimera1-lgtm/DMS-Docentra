import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CreateWorkOrderDto } from "./dto/create-work-order.dto";
import { ListWorkOrdersQueryDto } from "./dto/list-work-orders-query.dto";
import { UpdateWorkOrderDto } from "./dto/update-work-order.dto";
import { WorkOrdersService } from "./work-orders.service";

@ApiTags("manufacturing-work-orders")
@ApiBearerAuth()
@Controller("manufacturing/work-orders")
@AuditEntity("WorkOrder")
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.MANUFACTURING_READ)
  @ApiOperation({ summary: "List work orders (paginated, filterable by status/BOM/warehouse)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListWorkOrdersQueryDto) {
    return this.workOrdersService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.MANUFACTURING_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="work-orders.csv"')
  @ApiOperation({ summary: "Export work orders matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListWorkOrdersQueryDto) {
    return this.workOrdersService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.MANUFACTURING_READ)
  @ApiOperation({ summary: "Get a single work order" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.workOrdersService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.MANUFACTURING_WRITE)
  @ApiOperation({ summary: "Create a work order against a bill of material" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateWorkOrderDto) {
    return this.workOrdersService.create(user.companyId, user.id, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.MANUFACTURING_WRITE)
  @ApiOperation({ summary: "Update a draft work order" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateWorkOrderDto) {
    return this.workOrdersService.update(user.companyId, id, dto);
  }

  @Post(":id/start")
  @RequirePermissions(PERMISSIONS.MANUFACTURING_WRITE)
  @ApiOperation({ summary: "Start a draft work order, consuming component stock at its warehouse" })
  start(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.workOrdersService.start(user.companyId, user.id, id);
  }

  @Post(":id/complete")
  @RequirePermissions(PERMISSIONS.MANUFACTURING_WRITE)
  @ApiOperation({ summary: "Complete an in-progress work order, posting the finished-good yield" })
  complete(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.workOrdersService.complete(user.companyId, user.id, id);
  }

  @Post(":id/cancel")
  @RequirePermissions(PERMISSIONS.MANUFACTURING_WRITE)
  @ApiOperation({ summary: "Cancel a draft work order" })
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.workOrdersService.cancel(user.companyId, id);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.MANUFACTURING_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a draft work order" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.workOrdersService.remove(user.companyId, id);
  }
}

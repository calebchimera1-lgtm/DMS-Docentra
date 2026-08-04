import { Body, Controller, Get, Header, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CompleteMaintenanceDto } from "./dto/complete-maintenance.dto";
import { CreateMaintenanceDto } from "./dto/create-maintenance.dto";
import { ListMaintenanceQueryDto } from "./dto/list-maintenance-query.dto";
import { MaintenanceService } from "./maintenance.service";

@ApiTags("fleet-maintenance")
@ApiBearerAuth()
@Controller("fleet/maintenance")
@AuditEntity("MaintenanceRecord")
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.FLEET_READ)
  @ApiOperation({ summary: "List maintenance records (paginated, filterable by status/type/vehicle)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListMaintenanceQueryDto) {
    return this.maintenanceService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.FLEET_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="maintenance.csv"')
  @ApiOperation({ summary: "Export maintenance records matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListMaintenanceQueryDto) {
    return this.maintenanceService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.FLEET_READ)
  @ApiOperation({ summary: "Get a single maintenance record" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.maintenanceService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.FLEET_WRITE)
  @ApiOperation({ summary: "Schedule a maintenance job for a vehicle" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateMaintenanceDto) {
    return this.maintenanceService.create(user.companyId, dto);
  }

  @Post(":id/start")
  @RequirePermissions(PERMISSIONS.FLEET_WRITE)
  @ApiOperation({ summary: "Start a scheduled maintenance job, flipping the vehicle to IN_MAINTENANCE" })
  start(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.maintenanceService.start(user.companyId, id);
  }

  @Post(":id/complete")
  @RequirePermissions(PERMISSIONS.FLEET_WRITE)
  @ApiOperation({ summary: "Complete a maintenance job, flipping the vehicle back to ACTIVE" })
  complete(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: CompleteMaintenanceDto) {
    return this.maintenanceService.complete(user.companyId, id, dto);
  }

  @Post(":id/cancel")
  @RequirePermissions(PERMISSIONS.FLEET_WRITE)
  @ApiOperation({ summary: "Cancel a scheduled or in-progress maintenance job" })
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.maintenanceService.cancel(user.companyId, id);
  }
}

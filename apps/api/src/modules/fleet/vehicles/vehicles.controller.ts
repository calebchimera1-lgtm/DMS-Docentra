import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CreateVehicleDto } from "./dto/create-vehicle.dto";
import { ListVehiclesQueryDto } from "./dto/list-vehicles-query.dto";
import { UpdateVehicleDto } from "./dto/update-vehicle.dto";
import { VehiclesService } from "./vehicles.service";

@ApiTags("fleet-vehicles")
@ApiBearerAuth()
@Controller("fleet/vehicles")
@AuditEntity("Vehicle")
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.FLEET_READ)
  @ApiOperation({ summary: "List vehicles (paginated, filterable by status)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListVehiclesQueryDto) {
    return this.vehiclesService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.FLEET_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="vehicles.csv"')
  @ApiOperation({ summary: "Export vehicles matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListVehiclesQueryDto) {
    return this.vehiclesService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.FLEET_READ)
  @ApiOperation({ summary: "Get a single vehicle" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.vehiclesService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.FLEET_WRITE)
  @ApiOperation({ summary: "Create a vehicle" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.FLEET_WRITE)
  @ApiOperation({ summary: "Update a vehicle" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.update(user.companyId, id, dto);
  }

  @Post(":id/retire")
  @RequirePermissions(PERMISSIONS.FLEET_WRITE)
  @ApiOperation({ summary: "Retire a vehicle" })
  retire(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.vehiclesService.retire(user.companyId, id);
  }

  @Post(":id/reactivate")
  @RequirePermissions(PERMISSIONS.FLEET_WRITE)
  @ApiOperation({ summary: "Reactivate a retired vehicle" })
  reactivate(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.vehiclesService.reactivate(user.companyId, id);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.FLEET_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a retired vehicle" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.vehiclesService.remove(user.companyId, id);
  }
}

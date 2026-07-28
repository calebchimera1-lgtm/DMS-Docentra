import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CompleteTripDto } from "./dto/complete-trip.dto";
import { CreateTripDto } from "./dto/create-trip.dto";
import { ListTripsQueryDto } from "./dto/list-trips-query.dto";
import { TripsService } from "./trips.service";

@ApiTags("fleet-trips")
@ApiBearerAuth()
@Controller("fleet/trips")
@AuditEntity("Trip")
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.FLEET_READ)
  @ApiOperation({ summary: "List trips (paginated, filterable by status/vehicle)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListTripsQueryDto) {
    return this.tripsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.FLEET_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="trips.csv"')
  @ApiOperation({ summary: "Export trips matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListTripsQueryDto) {
    return this.tripsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.FLEET_READ)
  @ApiOperation({ summary: "Get a single trip" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.tripsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.FLEET_WRITE)
  @ApiOperation({ summary: "Start a trip, snapshotting the vehicle's current odometer reading" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateTripDto) {
    return this.tripsService.create(user.companyId, dto);
  }

  @Post(":id/complete")
  @RequirePermissions(PERMISSIONS.FLEET_WRITE)
  @ApiOperation({ summary: "Complete a trip, updating the vehicle's odometer reading" })
  complete(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: CompleteTripDto) {
    return this.tripsService.complete(user.companyId, id, dto);
  }

  @Post(":id/cancel")
  @RequirePermissions(PERMISSIONS.FLEET_WRITE)
  @ApiOperation({ summary: "Cancel an in-progress trip" })
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.tripsService.cancel(user.companyId, id);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.FLEET_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a completed or cancelled trip" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.tripsService.remove(user.companyId, id);
  }
}

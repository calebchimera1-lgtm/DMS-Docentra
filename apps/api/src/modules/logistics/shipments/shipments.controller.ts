import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CreateShipmentDto } from "./dto/create-shipment.dto";
import { DispatchShipmentDto } from "./dto/dispatch-shipment.dto";
import { FailShipmentDto } from "./dto/fail-shipment.dto";
import { ListShipmentsQueryDto } from "./dto/list-shipments-query.dto";
import { TrackShipmentDto } from "./dto/track-shipment.dto";
import { UpdateShipmentDto } from "./dto/update-shipment.dto";
import { ShipmentsService } from "./shipments.service";

@ApiTags("logistics-shipments")
@ApiBearerAuth()
@Controller("logistics/shipments")
@AuditEntity("Shipment")
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.LOGISTICS_READ)
  @ApiOperation({ summary: "List shipments (paginated, filterable by status/warehouse/vehicle)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListShipmentsQueryDto) {
    return this.shipmentsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.LOGISTICS_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="shipments.csv"')
  @ApiOperation({ summary: "Export shipments matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListShipmentsQueryDto) {
    return this.shipmentsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.LOGISTICS_READ)
  @ApiOperation({ summary: "Get a single shipment with its full delivery tracking timeline" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.shipmentsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.LOGISTICS_WRITE)
  @ApiOperation({ summary: "Create a draft shipment" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateShipmentDto) {
    return this.shipmentsService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.LOGISTICS_WRITE)
  @ApiOperation({ summary: "Edit a draft shipment" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateShipmentDto) {
    return this.shipmentsService.update(user.companyId, id, dto);
  }

  @Post(":id/dispatch")
  @RequirePermissions(PERMISSIONS.LOGISTICS_WRITE)
  @ApiOperation({ summary: "Dispatch a shipment: deducts stock and opens a Fleet trip when a vehicle is assigned" })
  dispatch(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: DispatchShipmentDto) {
    return this.shipmentsService.dispatch(user.companyId, user.id, id, dto);
  }

  @Post(":id/in-transit")
  @RequirePermissions(PERMISSIONS.LOGISTICS_WRITE)
  @ApiOperation({ summary: "Mark a dispatched shipment as in transit, recording its location" })
  markInTransit(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: TrackShipmentDto) {
    return this.shipmentsService.markInTransit(user.companyId, user.id, id, dto);
  }

  @Post(":id/deliver")
  @RequirePermissions(PERMISSIONS.LOGISTICS_WRITE)
  @ApiOperation({ summary: "Mark a shipment delivered" })
  deliver(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: TrackShipmentDto) {
    return this.shipmentsService.deliver(user.companyId, user.id, id, dto);
  }

  @Post(":id/fail")
  @RequirePermissions(PERMISSIONS.LOGISTICS_WRITE)
  @ApiOperation({ summary: "Mark a delivery failed, returning the dispatched stock" })
  fail(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: FailShipmentDto) {
    return this.shipmentsService.fail(user.companyId, user.id, id, dto);
  }

  @Post(":id/cancel")
  @RequirePermissions(PERMISSIONS.LOGISTICS_WRITE)
  @ApiOperation({ summary: "Cancel a draft shipment" })
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.shipmentsService.cancel(user.companyId, user.id, id);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.LOGISTICS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a draft or cancelled shipment" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.shipmentsService.remove(user.companyId, id);
  }
}

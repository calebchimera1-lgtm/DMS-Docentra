import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CreateWarehouseDto } from "./dto/create-warehouse.dto";
import { ListWarehousesQueryDto } from "./dto/list-warehouses-query.dto";
import { UpdateWarehouseDto } from "./dto/update-warehouse.dto";
import { WarehousesService } from "./warehouses.service";

@ApiTags("inventory-warehouses")
@ApiBearerAuth()
@Controller("inventory/warehouses")
@AuditEntity("Warehouse")
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  @ApiOperation({ summary: "List warehouses (paginated, searchable)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListWarehousesQueryDto) {
    return this.warehousesService.list(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  @ApiOperation({ summary: "Get a single warehouse" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.warehousesService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.INVENTORY_WRITE)
  @ApiOperation({ summary: "Create a warehouse" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateWarehouseDto) {
    return this.warehousesService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.INVENTORY_WRITE)
  @ApiOperation({ summary: "Update a warehouse" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehousesService.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.INVENTORY_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a warehouse (must hold no stock)" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.warehousesService.remove(user.companyId, id);
  }
}

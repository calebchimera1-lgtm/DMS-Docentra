import { Body, Controller, Get, Header, Param, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ListStockQueryDto } from "./dto/list-stock-query.dto";
import { UpdateStockSettingsDto } from "./dto/update-stock-settings.dto";
import { StockService } from "./stock.service";

@ApiTags("inventory-stock")
@ApiBearerAuth()
@Controller("inventory/stock")
@AuditEntity("StockItem")
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  @ApiOperation({ summary: "List current stock levels (paginated, searchable, low-stock filter)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListStockQueryDto) {
    return this.stockService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="stock-levels.csv"')
  @ApiOperation({ summary: "Export current stock levels matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListStockQueryDto) {
    return this.stockService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  @ApiOperation({ summary: "Get a single stock item" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.stockService.findOne(user.companyId, id);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.INVENTORY_WRITE)
  @ApiOperation({ summary: "Update reorder point/quantity for a stock item" })
  updateSettings(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateStockSettingsDto,
  ) {
    return this.stockService.updateSettings(user.companyId, id, dto);
  }
}

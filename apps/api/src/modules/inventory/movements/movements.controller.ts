import { Body, Controller, Get, Header, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CreateMovementDto } from "./dto/create-movement.dto";
import { ListMovementsQueryDto } from "./dto/list-movements-query.dto";
import { MovementsService } from "./movements.service";

@ApiTags("inventory-movements")
@ApiBearerAuth()
@Controller("inventory/movements")
@AuditEntity("StockMovement")
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  @ApiOperation({ summary: "List stock movements (the ledger), paginated and filterable" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListMovementsQueryDto) {
    return this.movementsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="stock-movements.csv"')
  @ApiOperation({ summary: "Export stock movements matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListMovementsQueryDto) {
    return this.movementsService.exportCsv(user.companyId, query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.INVENTORY_WRITE)
  @ApiOperation({ summary: "Record a stock movement (receipt, sale, adjustment, transfer, or return)" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateMovementDto) {
    return this.movementsService.create(user.companyId, user.id, dto);
  }
}

import { Body, Controller, Get, Header, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { ListSalesQueryDto } from "./dto/list-sales-query.dto";
import { RefundSaleDto } from "./dto/refund-sale.dto";
import { VoidSaleDto } from "./dto/void-sale.dto";
import { SalesService } from "./sales.service";

@ApiTags("pos-sales")
@ApiBearerAuth()
@Controller("pos/sales")
@AuditEntity("PosSale")
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.POS_READ)
  @ApiOperation({ summary: "List sales (paginated, filterable by status/payment method/session)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListSalesQueryDto) {
    return this.salesService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.POS_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="pos-sales.csv"')
  @ApiOperation({ summary: "Export sales matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListSalesQueryDto) {
    return this.salesService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.POS_READ)
  @ApiOperation({ summary: "Get a single sale" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.salesService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.POS_WRITE)
  @ApiOperation({ summary: "Ring up a sale against an open register session, deducting stock immediately" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSaleDto) {
    return this.salesService.create(user.companyId, user.id, dto);
  }

  @Post(":id/void")
  @RequirePermissions(PERMISSIONS.POS_WRITE)
  @ApiOperation({ summary: "Void a completed sale while its session is still open, restocking the items" })
  void(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: VoidSaleDto) {
    return this.salesService.void(user.companyId, user.id, id, dto);
  }

  @Post(":id/refund")
  @RequirePermissions(PERMISSIONS.POS_WRITE)
  @ApiOperation({ summary: "Refund a completed sale, restocking the items" })
  refund(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: RefundSaleDto) {
    return this.salesService.refund(user.companyId, user.id, id, dto);
  }
}

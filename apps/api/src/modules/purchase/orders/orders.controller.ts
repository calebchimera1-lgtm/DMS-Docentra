import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import { ListPurchaseOrdersQueryDto } from "./dto/list-purchase-orders-query.dto";
import { UpdatePurchaseOrderDto } from "./dto/update-purchase-order.dto";
import { PurchaseOrdersService } from "./orders.service";

@ApiTags("purchase-orders")
@ApiBearerAuth()
@Controller("purchase/orders")
@AuditEntity("PurchaseOrder")
export class PurchaseOrdersController {
  constructor(private readonly ordersService: PurchaseOrdersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PURCHASE_READ)
  @ApiOperation({ summary: "List purchase orders (paginated, searchable, filterable)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListPurchaseOrdersQueryDto) {
    return this.ordersService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.PURCHASE_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="purchase-orders.csv"')
  @ApiOperation({ summary: "Export purchase orders matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListPurchaseOrdersQueryDto) {
    return this.ordersService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.PURCHASE_READ)
  @ApiOperation({ summary: "Get a single purchase order" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.ordersService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PURCHASE_WRITE)
  @ApiOperation({ summary: "Create a draft purchase order" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePurchaseOrderDto) {
    return this.ordersService.create(user.companyId, user.id, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.PURCHASE_WRITE)
  @ApiOperation({ summary: "Update a purchase order (draft/sent/confirmed only)" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdatePurchaseOrderDto) {
    return this.ordersService.update(user.companyId, id, dto);
  }

  @Post(":id/receive")
  @RequirePermissions(PERMISSIONS.PURCHASE_WRITE)
  @ApiOperation({ summary: "Receive a confirmed purchase order, posting inbound stock movements" })
  receive(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.ordersService.receive(user.companyId, user.id, id);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.PURCHASE_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a draft or cancelled purchase order" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.ordersService.remove(user.companyId, id);
  }
}

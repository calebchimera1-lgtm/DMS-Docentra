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
import { CreateSalesOrderDto } from "./dto/create-order.dto";
import { FulfillOrderDto } from "./dto/fulfill-order.dto";
import { ListOrdersQueryDto } from "./dto/list-orders-query.dto";
import { UpdateSalesOrderDto } from "./dto/update-order.dto";
import { OrdersService } from "./orders.service";

@ApiTags("sales-orders")
@ApiBearerAuth()
@Controller("sales/orders")
@AuditEntity("SalesOrder")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: "List sales orders (paginated, searchable, filterable by status)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListOrdersQueryDto) {
    return this.ordersService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="sales-orders.csv"')
  @ApiOperation({ summary: "Export sales orders matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListOrdersQueryDto) {
    return this.ordersService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: "Get a single sales order" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.ordersService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: "Create a sales order directly (not from a quote)" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSalesOrderDto) {
    return this.ordersService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: "Update a sales order (including its status)" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateSalesOrderDto) {
    return this.ordersService.update(user.companyId, id, dto);
  }

  @Post(":id/convert-to-invoice")
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: "Convert a sales order into an invoice" })
  convertToInvoice(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.ordersService.convertToInvoice(user.companyId, id);
  }

  @Post(":id/fulfill")
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: "Fulfill a sales order — deducts stock for each line item and records the movement" })
  fulfill(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: FulfillOrderDto) {
    return this.ordersService.fulfill(user.companyId, user.id, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.SALES_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a sales order" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.ordersService.remove(user.companyId, id);
  }
}

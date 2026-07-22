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
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { ListInvoicesQueryDto } from "./dto/list-invoices-query.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { InvoicesService } from "./invoices.service";

@ApiTags("sales-invoices")
@ApiBearerAuth()
@Controller("sales/invoices")
@AuditEntity("Invoice")
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: "List invoices (paginated, searchable, filterable by status)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListInvoicesQueryDto) {
    return this.invoicesService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="invoices.csv"')
  @ApiOperation({ summary: "Export invoices matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListInvoicesQueryDto) {
    return this.invoicesService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: "Get a single invoice" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.invoicesService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: "Create an invoice directly (not from a sales order)" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: "Update an invoice (including its status)" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoicesService.update(user.companyId, id, dto);
  }

  @Post(":id/mark-paid")
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: "Record that an invoice has been paid in full" })
  markPaid(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.invoicesService.markPaid(user.companyId, id);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.SALES_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an invoice" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.invoicesService.remove(user.companyId, id);
  }
}

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
import { CreateQuoteDto } from "./dto/create-quote.dto";
import { ListQuotesQueryDto } from "./dto/list-quotes-query.dto";
import { UpdateQuoteDto } from "./dto/update-quote.dto";
import { QuotesService } from "./quotes.service";

@ApiTags("sales-quotes")
@ApiBearerAuth()
@Controller("sales/quotes")
@AuditEntity("Quote")
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: "List quotes (paginated, searchable, filterable by status)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListQuotesQueryDto) {
    return this.quotesService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="quotes.csv"')
  @ApiOperation({ summary: "Export quotes matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListQuotesQueryDto) {
    return this.quotesService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: "Get a single quote" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.quotesService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: "Create a quote" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateQuoteDto) {
    return this.quotesService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: "Update a quote (including its status)" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotesService.update(user.companyId, id, dto);
  }

  @Post(":id/convert-to-order")
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: "Convert an accepted quote into a sales order" })
  convertToOrder(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.quotesService.convertToOrder(user.companyId, id);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.SALES_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a quote" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.quotesService.remove(user.companyId, id);
  }
}

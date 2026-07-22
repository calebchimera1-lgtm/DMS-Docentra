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
import { CreateProductDto } from "./dto/create-product.dto";
import { ListProductsQueryDto } from "./dto/list-products-query.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

@ApiTags("sales-products")
@ApiBearerAuth()
@Controller("sales/products")
@AuditEntity("Product")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: "List products (paginated, searchable)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListProductsQueryDto) {
    return this.productsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="products.csv"')
  @ApiOperation({ summary: "Export products matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListProductsQueryDto) {
    return this.productsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: "Get a single product" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.productsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: "Create a product" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: "Update a product" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.SALES_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a product" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.productsService.remove(user.companyId, id);
  }
}

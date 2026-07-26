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
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { ListSuppliersQueryDto } from "./dto/list-suppliers-query.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { SuppliersService } from "./suppliers.service";

@ApiTags("purchase-suppliers")
@ApiBearerAuth()
@Controller("purchase/suppliers")
@AuditEntity("Supplier")
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PURCHASE_READ)
  @ApiOperation({ summary: "List suppliers (paginated, searchable)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListSuppliersQueryDto) {
    return this.suppliersService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.PURCHASE_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="suppliers.csv"')
  @ApiOperation({ summary: "Export suppliers matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListSuppliersQueryDto) {
    return this.suppliersService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.PURCHASE_READ)
  @ApiOperation({ summary: "Get a single supplier" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.suppliersService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PURCHASE_WRITE)
  @ApiOperation({ summary: "Create a supplier" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.PURCHASE_WRITE)
  @ApiOperation({ summary: "Update a supplier" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.PURCHASE_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a supplier (must have no purchase orders)" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.suppliersService.remove(user.companyId, id);
  }
}

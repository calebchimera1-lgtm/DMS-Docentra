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
import { AssetCategoriesService } from "./asset-categories.service";
import { CreateAssetCategoryDto } from "./dto/create-asset-category.dto";
import { ListAssetCategoriesQueryDto } from "./dto/list-asset-categories-query.dto";
import { UpdateAssetCategoryDto } from "./dto/update-asset-category.dto";

@ApiTags("assets-categories")
@ApiBearerAuth()
@Controller("assets/categories")
@AuditEntity("AssetCategory")
export class AssetCategoriesController {
  constructor(private readonly assetCategoriesService: AssetCategoriesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  @ApiOperation({ summary: "List asset categories (paginated, searchable)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListAssetCategoriesQueryDto) {
    return this.assetCategoriesService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="asset-categories.csv"')
  @ApiOperation({ summary: "Export asset categories matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListAssetCategoriesQueryDto) {
    return this.assetCategoriesService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  @ApiOperation({ summary: "Get a single asset category" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.assetCategoriesService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  @ApiOperation({ summary: "Create an asset category" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateAssetCategoryDto) {
    return this.assetCategoriesService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  @ApiOperation({ summary: "Update an asset category" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateAssetCategoryDto) {
    return this.assetCategoriesService.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.ASSETS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an asset category" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.assetCategoriesService.remove(user.companyId, id);
  }
}

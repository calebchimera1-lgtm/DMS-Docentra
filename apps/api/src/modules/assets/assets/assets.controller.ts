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
import { AssetsService } from "./assets.service";
import { CreateAssetDto } from "./dto/create-asset.dto";
import { DisposeAssetDto } from "./dto/dispose-asset.dto";
import { ListAssetsQueryDto } from "./dto/list-assets-query.dto";
import { UpdateAssetDto } from "./dto/update-asset.dto";

@ApiTags("assets-assets")
@ApiBearerAuth()
@Controller("assets/assets")
@AuditEntity("Asset")
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  @ApiOperation({ summary: "List assets (paginated, filterable by status/category)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListAssetsQueryDto) {
    return this.assetsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="assets.csv"')
  @ApiOperation({ summary: "Export assets matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListAssetsQueryDto) {
    return this.assetsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  @ApiOperation({ summary: "Get a single asset" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.assetsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  @ApiOperation({ summary: "Register a fixed asset" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateAssetDto) {
    return this.assetsService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  @ApiOperation({ summary: "Update an active asset" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateAssetDto) {
    return this.assetsService.update(user.companyId, id, dto);
  }

  @Post(":id/dispose")
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  @ApiOperation({ summary: "Dispose of an active asset, posting the resulting gain/loss to Accounting" })
  dispose(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: DisposeAssetDto) {
    return this.assetsService.dispose(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.ASSETS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an active asset that has never been depreciated" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.assetsService.remove(user.companyId, id);
  }
}

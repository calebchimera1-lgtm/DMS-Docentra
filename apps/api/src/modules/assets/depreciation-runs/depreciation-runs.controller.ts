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
import { CreateDepreciationRunDto } from "./dto/create-depreciation-run.dto";
import { ListDepreciationRunsQueryDto } from "./dto/list-depreciation-runs-query.dto";
import { UpdateDepreciationRunDto } from "./dto/update-depreciation-run.dto";
import { DepreciationRunsService } from "./depreciation-runs.service";

@ApiTags("assets-depreciation-runs")
@ApiBearerAuth()
@Controller("assets/depreciation-runs")
@AuditEntity("DepreciationRun")
export class DepreciationRunsController {
  constructor(private readonly depreciationRunsService: DepreciationRunsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  @ApiOperation({ summary: "List depreciation runs (paginated, filterable by status)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListDepreciationRunsQueryDto) {
    return this.depreciationRunsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="depreciation-runs.csv"')
  @ApiOperation({ summary: "Export depreciation runs matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListDepreciationRunsQueryDto) {
    return this.depreciationRunsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  @ApiOperation({ summary: "Get a single depreciation run" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.depreciationRunsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  @ApiOperation({ summary: "Create a draft depreciation run for a period" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateDepreciationRunDto) {
    return this.depreciationRunsService.create(user.companyId, user.id, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  @ApiOperation({ summary: "Update a draft depreciation run's period" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateDepreciationRunDto) {
    return this.depreciationRunsService.update(user.companyId, id, dto);
  }

  @Post(":id/generate")
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  @ApiOperation({ summary: "Post one period of straight-line depreciation for every active asset" })
  generate(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.depreciationRunsService.generate(user.companyId, id);
  }

  @Post(":id/cancel")
  @RequirePermissions(PERMISSIONS.ASSETS_WRITE)
  @ApiOperation({ summary: "Cancel a draft depreciation run" })
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.depreciationRunsService.cancel(user.companyId, id);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.ASSETS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a draft depreciation run" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.depreciationRunsService.remove(user.companyId, id);
  }
}

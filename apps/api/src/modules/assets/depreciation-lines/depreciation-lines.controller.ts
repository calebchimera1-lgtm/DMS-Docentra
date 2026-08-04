import { Controller, Get, Header, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { DepreciationLinesService } from "./depreciation-lines.service";
import { ListDepreciationLinesQueryDto } from "./dto/list-depreciation-lines-query.dto";

@ApiTags("assets-depreciation-lines")
@ApiBearerAuth()
@Controller("assets/depreciation-lines")
@RequirePermissions(PERMISSIONS.ASSETS_READ)
export class DepreciationLinesController {
  constructor(private readonly depreciationLinesService: DepreciationLinesService) {}

  @Get()
  @ApiOperation({ summary: "List depreciation lines (paginated, filterable by run/asset)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListDepreciationLinesQueryDto) {
    return this.depreciationLinesService.list(user.companyId, query);
  }

  @Get("export")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="depreciation-lines.csv"')
  @ApiOperation({ summary: "Export depreciation lines matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListDepreciationLinesQueryDto) {
    return this.depreciationLinesService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single depreciation line" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.depreciationLinesService.findOne(user.companyId, id);
  }
}

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
import { CreateDealDto } from "./dto/create-deal.dto";
import { ListDealsQueryDto } from "./dto/list-deals-query.dto";
import { UpdateDealDto } from "./dto/update-deal.dto";
import { DealsService } from "./deals.service";

@ApiTags("crm-deals")
@ApiBearerAuth()
@Controller("crm/deals")
@AuditEntity("CrmDeal")
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CRM_READ)
  @ApiOperation({ summary: "List CRM deals (paginated, searchable, filterable by stage)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListDealsQueryDto) {
    return this.dealsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.CRM_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="crm-deals.csv"')
  @ApiOperation({ summary: "Export CRM deals matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListDealsQueryDto) {
    return this.dealsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.CRM_READ)
  @ApiOperation({ summary: "Get a single CRM deal" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.dealsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  @ApiOperation({ summary: "Create a CRM deal" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateDealDto) {
    return this.dealsService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  @ApiOperation({ summary: "Update a CRM deal (including moving it to a new stage)" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateDealDto) {
    return this.dealsService.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.CRM_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a CRM deal" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.dealsService.remove(user.companyId, id);
  }
}

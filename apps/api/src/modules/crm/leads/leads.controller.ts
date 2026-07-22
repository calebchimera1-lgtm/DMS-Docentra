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
import { CreateLeadDto } from "./dto/create-lead.dto";
import { ListLeadsQueryDto } from "./dto/list-leads-query.dto";
import { UpdateLeadDto } from "./dto/update-lead.dto";
import { LeadsService } from "./leads.service";

@ApiTags("crm-leads")
@ApiBearerAuth()
@Controller("crm/leads")
@AuditEntity("CrmLead")
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CRM_READ)
  @ApiOperation({ summary: "List CRM leads (paginated, searchable, filterable by status)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListLeadsQueryDto) {
    return this.leadsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.CRM_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="crm-leads.csv"')
  @ApiOperation({ summary: "Export CRM leads matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListLeadsQueryDto) {
    return this.leadsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.CRM_READ)
  @ApiOperation({ summary: "Get a single CRM lead" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.leadsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  @ApiOperation({ summary: "Create a CRM lead" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateLeadDto) {
    return this.leadsService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  @ApiOperation({ summary: "Update a CRM lead" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(user.companyId, id, dto);
  }

  @Post(":id/convert")
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  @ApiOperation({ summary: "Convert a lead into an account + contact" })
  convert(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.leadsService.convert(user.companyId, id);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.CRM_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a CRM lead" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.leadsService.remove(user.companyId, id);
  }
}

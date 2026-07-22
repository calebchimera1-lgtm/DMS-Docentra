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
import { AccountsService } from "./accounts.service";
import { CreateAccountDto } from "./dto/create-account.dto";
import { ListAccountsQueryDto } from "./dto/list-accounts-query.dto";
import { UpdateAccountDto } from "./dto/update-account.dto";

@ApiTags("crm-accounts")
@ApiBearerAuth()
@Controller("crm/accounts")
@AuditEntity("CrmAccount")
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CRM_READ)
  @ApiOperation({ summary: "List CRM accounts (paginated, searchable)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListAccountsQueryDto) {
    return this.accountsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.CRM_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="crm-accounts.csv"')
  @ApiOperation({ summary: "Export CRM accounts matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListAccountsQueryDto) {
    return this.accountsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.CRM_READ)
  @ApiOperation({ summary: "Get a single CRM account with its contacts and deals" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.accountsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  @ApiOperation({ summary: "Create a CRM account" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  @ApiOperation({ summary: "Update a CRM account" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateAccountDto) {
    return this.accountsService.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.CRM_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a CRM account" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.accountsService.remove(user.companyId, id);
  }
}

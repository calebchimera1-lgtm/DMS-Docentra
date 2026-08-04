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
import { CreateLedgerAccountDto } from "./dto/create-ledger-account.dto";
import { ListLedgerAccountsQueryDto } from "./dto/list-ledger-accounts-query.dto";
import { UpdateLedgerAccountDto } from "./dto/update-ledger-account.dto";
import { LedgerAccountsService } from "./ledger-accounts.service";

@ApiTags("accounting-ledger-accounts")
@ApiBearerAuth()
@Controller("accounting/ledger-accounts")
@AuditEntity("LedgerAccount")
export class LedgerAccountsController {
  constructor(private readonly ledgerAccountsService: LedgerAccountsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ACCOUNTING_READ)
  @ApiOperation({ summary: "List ledger accounts (paginated, searchable, filterable by type)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListLedgerAccountsQueryDto) {
    return this.ledgerAccountsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.ACCOUNTING_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="ledger-accounts.csv"')
  @ApiOperation({ summary: "Export ledger accounts matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListLedgerAccountsQueryDto) {
    return this.ledgerAccountsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.ACCOUNTING_READ)
  @ApiOperation({ summary: "Get a single ledger account" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.ledgerAccountsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ACCOUNTING_WRITE)
  @ApiOperation({ summary: "Create a ledger account" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateLedgerAccountDto) {
    return this.ledgerAccountsService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.ACCOUNTING_WRITE)
  @ApiOperation({ summary: "Update a ledger account" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateLedgerAccountDto) {
    return this.ledgerAccountsService.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.ACCOUNTING_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a ledger account (must have no journal activity)" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.ledgerAccountsService.remove(user.companyId, id);
  }
}

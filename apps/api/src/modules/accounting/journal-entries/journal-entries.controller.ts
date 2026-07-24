import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CreateJournalEntryDto } from "./dto/create-journal-entry.dto";
import { ListJournalEntriesQueryDto } from "./dto/list-journal-entries-query.dto";
import { JournalEntriesService } from "./journal-entries.service";

@ApiTags("accounting-journal-entries")
@ApiBearerAuth()
@Controller("accounting/journal-entries")
@AuditEntity("JournalEntry")
export class JournalEntriesController {
  constructor(private readonly journalEntriesService: JournalEntriesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ACCOUNTING_READ)
  @ApiOperation({ summary: "List journal entries (paginated, searchable, filterable by status)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListJournalEntriesQueryDto) {
    return this.journalEntriesService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.ACCOUNTING_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="journal-entries.csv"')
  @ApiOperation({ summary: "Export journal entries matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListJournalEntriesQueryDto) {
    return this.journalEntriesService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.ACCOUNTING_READ)
  @ApiOperation({ summary: "Get a single journal entry with its lines" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.journalEntriesService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ACCOUNTING_WRITE)
  @ApiOperation({ summary: "Create a draft journal entry (must balance: total debits == total credits)" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateJournalEntryDto) {
    return this.journalEntriesService.create(user.companyId, user.id, dto);
  }

  @Post(":id/post")
  @RequirePermissions(PERMISSIONS.ACCOUNTING_WRITE)
  @ApiOperation({ summary: "Post a draft journal entry (becomes immutable)" })
  post(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.journalEntriesService.post(user.companyId, id);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.ACCOUNTING_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a draft journal entry (posted entries cannot be deleted)" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.journalEntriesService.remove(user.companyId, id);
  }
}

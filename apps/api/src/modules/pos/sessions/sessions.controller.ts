import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CloseSessionDto } from "./dto/close-session.dto";
import { ListSessionsQueryDto } from "./dto/list-sessions-query.dto";
import { OpenSessionDto } from "./dto/open-session.dto";
import { SessionsService } from "./sessions.service";

@ApiTags("pos-sessions")
@ApiBearerAuth()
@Controller("pos/sessions")
@AuditEntity("PosRegisterSession")
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.POS_READ)
  @ApiOperation({ summary: "List register sessions (paginated, filterable by status/warehouse)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListSessionsQueryDto) {
    return this.sessionsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.POS_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="pos-sessions.csv"')
  @ApiOperation({ summary: "Export register sessions matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListSessionsQueryDto) {
    return this.sessionsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.POS_READ)
  @ApiOperation({ summary: "Get a single register session" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.sessionsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.POS_WRITE)
  @ApiOperation({ summary: "Open a register session for a warehouse" })
  open(@CurrentUser() user: RequestUser, @Body() dto: OpenSessionDto) {
    return this.sessionsService.open(user.companyId, user.id, dto);
  }

  @Post(":id/close")
  @RequirePermissions(PERMISSIONS.POS_WRITE)
  @ApiOperation({ summary: "Close a register session, reconciling counted cash against expected cash" })
  close(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: CloseSessionDto) {
    return this.sessionsService.close(user.companyId, user.id, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.POS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an open register session with no sales recorded against it" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.sessionsService.remove(user.companyId, id);
  }
}

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
import { AssignTicketDto } from "./dto/assign-ticket.dto";
import { CreateTicketDto } from "./dto/create-ticket.dto";
import { ListTicketsQueryDto } from "./dto/list-tickets-query.dto";
import { UpdateTicketDto } from "./dto/update-ticket.dto";
import { TicketsService } from "./tickets.service";

@ApiTags("support-tickets")
@ApiBearerAuth()
@Controller("support/tickets")
@AuditEntity("Ticket")
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SUPPORT_READ)
  @ApiOperation({ summary: "List tickets (paginated, searchable, filterable)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListTicketsQueryDto) {
    return this.ticketsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.SUPPORT_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="tickets.csv"')
  @ApiOperation({ summary: "Export tickets matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListTicketsQueryDto) {
    return this.ticketsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.SUPPORT_READ)
  @ApiOperation({ summary: "Get a single ticket" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.ticketsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SUPPORT_WRITE)
  @ApiOperation({ summary: "Create a ticket (starts OPEN, or IN_PROGRESS if assigned at creation)" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateTicketDto) {
    return this.ticketsService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.SUPPORT_WRITE)
  @ApiOperation({ summary: "Update a ticket" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateTicketDto) {
    return this.ticketsService.update(user.companyId, id, dto);
  }

  @Post(":id/assign")
  @RequirePermissions(PERMISSIONS.SUPPORT_WRITE)
  @ApiOperation({ summary: "Assign a ticket to a user (moves OPEN tickets to IN_PROGRESS)" })
  assign(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: AssignTicketDto) {
    return this.ticketsService.assign(user.companyId, id, dto.assigneeId);
  }

  @Post(":id/resolve")
  @RequirePermissions(PERMISSIONS.SUPPORT_WRITE)
  @ApiOperation({ summary: "Mark an open ticket resolved" })
  resolve(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.ticketsService.resolve(user.companyId, id);
  }

  @Post(":id/close")
  @RequirePermissions(PERMISSIONS.SUPPORT_WRITE)
  @ApiOperation({ summary: "Close a ticket" })
  close(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.ticketsService.close(user.companyId, id);
  }

  @Post(":id/reopen")
  @RequirePermissions(PERMISSIONS.SUPPORT_WRITE)
  @ApiOperation({ summary: "Reopen a resolved or closed ticket" })
  reopen(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.ticketsService.reopen(user.companyId, id);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.SUPPORT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a ticket" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.ticketsService.remove(user.companyId, id);
  }
}

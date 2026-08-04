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
import { CreateTimeEntryDto } from "./dto/create-time-entry.dto";
import { ListTimeEntriesQueryDto } from "./dto/list-time-entries-query.dto";
import { UpdateTimeEntryDto } from "./dto/update-time-entry.dto";
import { TimeEntriesService } from "./time-entries.service";

@ApiTags("project-time-entries")
@ApiBearerAuth()
@Controller("projects/time-entries")
@AuditEntity("TimeEntry")
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PROJECTS_READ)
  @ApiOperation({ summary: "List time entries (paginated, filterable by task/project/user/billable)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListTimeEntriesQueryDto) {
    return this.timeEntriesService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.PROJECTS_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="time-entries.csv"')
  @ApiOperation({ summary: "Export time entries matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListTimeEntriesQueryDto) {
    return this.timeEntriesService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.PROJECTS_READ)
  @ApiOperation({ summary: "Get a single time entry" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.timeEntriesService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PROJECTS_WRITE)
  @ApiOperation({ summary: "Log time against a task (logged for the calling user)" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateTimeEntryDto) {
    return this.timeEntriesService.create(user.companyId, user.id, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.PROJECTS_WRITE)
  @ApiOperation({ summary: "Update one of the calling user's own time entries" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateTimeEntryDto) {
    return this.timeEntriesService.update(user.companyId, user.id, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.PROJECTS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete one of the calling user's own time entries" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.timeEntriesService.remove(user.companyId, user.id, id);
  }
}

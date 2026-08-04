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
import { CreateTaskDto } from "./dto/create-task.dto";
import { ListTasksQueryDto } from "./dto/list-tasks-query.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { TasksService } from "./tasks.service";

@ApiTags("project-tasks")
@ApiBearerAuth()
@Controller("projects/tasks")
@AuditEntity("ProjectTask")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PROJECTS_READ)
  @ApiOperation({ summary: "List tasks (paginated, filterable by project/status/priority/assignee)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListTasksQueryDto) {
    return this.tasksService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.PROJECTS_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="tasks.csv"')
  @ApiOperation({ summary: "Export tasks matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListTasksQueryDto) {
    return this.tasksService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.PROJECTS_READ)
  @ApiOperation({ summary: "Get a single task" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.tasksService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PROJECTS_WRITE)
  @ApiOperation({ summary: "Create a task" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.PROJECTS_WRITE)
  @ApiOperation({ summary: "Update a task" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.PROJECTS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a task (must have no logged time entries)" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.tasksService.remove(user.companyId, id);
  }
}

import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ProjectsReportsService } from "./projects-reports.service";

@ApiTags("projects-reports")
@ApiBearerAuth()
@Controller("projects/reports")
@RequirePermissions(PERMISSIONS.PROJECTS_READ)
export class ProjectsReportsController {
  constructor(private readonly reportsService: ProjectsReportsService) {}

  @Get("summary")
  @ApiOperation({ summary: "Top-line project stats for the module dashboard (active projects, open/overdue tasks, hours logged)" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Get("tasks-by-status")
  @ApiOperation({ summary: "Task counts grouped by status" })
  tasksByStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.tasksByStatus(user.companyId);
  }
}

import { Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ProjectsReportsService } from "./projects-reports.service";
import { ProjectsSummaryType, TasksByStatusType } from "./graphql/projects-summary.type";

@Resolver()
@RequirePermissions(PERMISSIONS.PROJECTS_READ)
export class ProjectsReportsResolver {
  constructor(private readonly reportsService: ProjectsReportsService) {}

  @Query(() => ProjectsSummaryType, { name: "projectsSummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Query(() => [TasksByStatusType], { name: "projectsTasksByStatus" })
  tasksByStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.tasksByStatus(user.companyId);
  }
}

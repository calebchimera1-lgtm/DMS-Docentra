import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { ProjectStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ProjectsService } from "./projects.service";
import { ListProjectsArgs, PaginatedProjects } from "./graphql/list-projects.args";
import { toProjectItemType } from "./graphql/project.mapper";
import { ProjectItemType } from "./graphql/project.type";

@Resolver(() => ProjectItemType)
@RequirePermissions(PERMISSIONS.PROJECTS_READ)
export class ProjectsResolver {
  constructor(private readonly projectsService: ProjectsService) {}

  @Query(() => PaginatedProjects, { name: "projects" })
  async projects(
    @CurrentUser() user: RequestUser,
    @Args() args: ListProjectsArgs,
  ): Promise<PaginatedProjects> {
    const result = await this.projectsService.list(user.companyId, {
      ...args,
      status: args.status as ProjectStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toProjectItemType>[0][]).map(toProjectItemType),
    };
  }

  @Query(() => ProjectItemType, { name: "project" })
  async project(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ProjectItemType> {
    const project = await this.projectsService.findOne(user.companyId, id);
    return toProjectItemType(project);
  }
}

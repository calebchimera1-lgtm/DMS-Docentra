import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { TaskPriority, TaskStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { TasksService } from "./tasks.service";
import { ListTasksArgs, PaginatedTasks } from "./graphql/list-tasks.args";
import { toProjectTaskItemType } from "./graphql/task.mapper";
import { ProjectTaskItemType } from "./graphql/task.type";

@Resolver(() => ProjectTaskItemType)
@RequirePermissions(PERMISSIONS.PROJECTS_READ)
export class TasksResolver {
  constructor(private readonly tasksService: TasksService) {}

  @Query(() => PaginatedTasks, { name: "projectTasks" })
  async projectTasks(
    @CurrentUser() user: RequestUser,
    @Args() args: ListTasksArgs,
  ): Promise<PaginatedTasks> {
    const result = await this.tasksService.list(user.companyId, {
      ...args,
      status: args.status as TaskStatus | undefined,
      priority: args.priority as TaskPriority | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toProjectTaskItemType>[0][]).map(toProjectTaskItemType),
    };
  }

  @Query(() => ProjectTaskItemType, { name: "projectTask" })
  async projectTask(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ProjectTaskItemType> {
    const task = await this.tasksService.findOne(user.companyId, id);
    return toProjectTaskItemType(task);
  }
}

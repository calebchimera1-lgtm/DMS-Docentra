import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { ApplicationStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ApplicationsService } from "./applications.service";
import { ListApplicationsArgs, PaginatedApplications } from "./graphql/list-applications.args";
import { toApplicationItemType } from "./graphql/application.mapper";
import { ApplicationItemType } from "./graphql/application.type";

@Resolver(() => ApplicationItemType)
@RequirePermissions(PERMISSIONS.RECRUITMENT_READ)
export class ApplicationsResolver {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Query(() => PaginatedApplications, { name: "applications" })
  async applications(
    @CurrentUser() user: RequestUser,
    @Args() args: ListApplicationsArgs,
  ): Promise<PaginatedApplications> {
    const result = await this.applicationsService.list(user.companyId, {
      ...args,
      status: args.status as ApplicationStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toApplicationItemType>[0][]).map(toApplicationItemType),
    };
  }

  @Query(() => ApplicationItemType, { name: "application" })
  async application(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ApplicationItemType> {
    const application = await this.applicationsService.findOne(user.companyId, id);
    return toApplicationItemType(application);
  }
}

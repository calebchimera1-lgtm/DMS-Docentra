import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { JobPostingStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { JobPostingsService } from "./job-postings.service";
import { ListJobPostingsArgs, PaginatedJobPostings } from "./graphql/list-job-postings.args";
import { toJobPostingItemType } from "./graphql/job-posting.mapper";
import { JobPostingItemType } from "./graphql/job-posting.type";

@Resolver(() => JobPostingItemType)
@RequirePermissions(PERMISSIONS.RECRUITMENT_READ)
export class JobPostingsResolver {
  constructor(private readonly jobPostingsService: JobPostingsService) {}

  @Query(() => PaginatedJobPostings, { name: "jobPostings" })
  async jobPostings(
    @CurrentUser() user: RequestUser,
    @Args() args: ListJobPostingsArgs,
  ): Promise<PaginatedJobPostings> {
    const result = await this.jobPostingsService.list(user.companyId, {
      ...args,
      status: args.status as JobPostingStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toJobPostingItemType>[0][]).map(toJobPostingItemType),
    };
  }

  @Query(() => JobPostingItemType, { name: "jobPosting" })
  async jobPosting(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<JobPostingItemType> {
    const posting = await this.jobPostingsService.findOne(user.companyId, id);
    return toJobPostingItemType(posting);
  }
}

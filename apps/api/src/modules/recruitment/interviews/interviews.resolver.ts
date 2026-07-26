import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { InterviewStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { InterviewsService } from "./interviews.service";
import { ListInterviewsArgs, PaginatedInterviews } from "./graphql/list-interviews.args";
import { toInterviewItemType } from "./graphql/interview.mapper";
import { InterviewItemType } from "./graphql/interview.type";

@Resolver(() => InterviewItemType)
@RequirePermissions(PERMISSIONS.RECRUITMENT_READ)
export class InterviewsResolver {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Query(() => PaginatedInterviews, { name: "interviews" })
  async interviews(
    @CurrentUser() user: RequestUser,
    @Args() args: ListInterviewsArgs,
  ): Promise<PaginatedInterviews> {
    const result = await this.interviewsService.list(user.companyId, {
      ...args,
      status: args.status as InterviewStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toInterviewItemType>[0][]).map(toInterviewItemType),
    };
  }

  @Query(() => InterviewItemType, { name: "interview" })
  async interview(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<InterviewItemType> {
    const interview = await this.interviewsService.findOne(user.companyId, id);
    return toInterviewItemType(interview);
  }
}

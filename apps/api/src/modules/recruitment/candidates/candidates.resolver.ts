import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CandidatesService } from "./candidates.service";
import { ListCandidatesArgs, PaginatedCandidates } from "./graphql/list-candidates.args";
import { toCandidateItemType } from "./graphql/candidate.mapper";
import { CandidateItemType } from "./graphql/candidate.type";

@Resolver(() => CandidateItemType)
@RequirePermissions(PERMISSIONS.RECRUITMENT_READ)
export class CandidatesResolver {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Query(() => PaginatedCandidates, { name: "candidates" })
  async candidates(
    @CurrentUser() user: RequestUser,
    @Args() args: ListCandidatesArgs,
  ): Promise<PaginatedCandidates> {
    const result = await this.candidatesService.list(user.companyId, args);
    return {
      ...result,
      items: (result.items as Parameters<typeof toCandidateItemType>[0][]).map(toCandidateItemType),
    };
  }

  @Query(() => CandidateItemType, { name: "candidate" })
  async candidate(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<CandidateItemType> {
    const candidate = await this.candidatesService.findOne(user.companyId, id);
    return toCandidateItemType(candidate);
  }
}

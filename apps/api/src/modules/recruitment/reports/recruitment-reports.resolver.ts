import { Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { RecruitmentReportsService } from "./recruitment-reports.service";
import { ApplicationsByStatusType, RecruitmentSummaryType } from "./graphql/recruitment-summary.type";

@Resolver()
@RequirePermissions(PERMISSIONS.RECRUITMENT_READ)
export class RecruitmentReportsResolver {
  constructor(private readonly reportsService: RecruitmentReportsService) {}

  @Query(() => RecruitmentSummaryType, { name: "recruitmentSummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Query(() => [ApplicationsByStatusType], { name: "applicationsByStatus" })
  applicationsByStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.applicationsByStatus(user.companyId);
  }
}

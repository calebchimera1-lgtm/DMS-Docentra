import { Module } from "@nestjs/common";
import { JobPostingsController } from "./job-postings/job-postings.controller";
import { JobPostingsResolver } from "./job-postings/job-postings.resolver";
import { JobPostingsService } from "./job-postings/job-postings.service";
import { CandidatesController } from "./candidates/candidates.controller";
import { CandidatesResolver } from "./candidates/candidates.resolver";
import { CandidatesService } from "./candidates/candidates.service";
import { ApplicationsController } from "./applications/applications.controller";
import { ApplicationsResolver } from "./applications/applications.resolver";
import { ApplicationsService } from "./applications/applications.service";
import { InterviewsController } from "./interviews/interviews.controller";
import { InterviewsResolver } from "./interviews/interviews.resolver";
import { InterviewsService } from "./interviews/interviews.service";
import { RecruitmentReportsController } from "./reports/recruitment-reports.controller";
import { RecruitmentReportsResolver } from "./reports/recruitment-reports.resolver";
import { RecruitmentReportsService } from "./reports/recruitment-reports.service";

@Module({
  // Sibling literal sub-paths under "recruitment" (job-postings, candidates,
  // applications, interviews, reports) — no controller claims the bare
  // "recruitment" root, so there's no ":id" wildcard for any of them to
  // shadow (same collision-avoidance-by-construction as every module since
  // Projects).
  controllers: [
    JobPostingsController,
    CandidatesController,
    ApplicationsController,
    InterviewsController,
    RecruitmentReportsController,
  ],
  providers: [
    JobPostingsService,
    JobPostingsResolver,
    CandidatesService,
    CandidatesResolver,
    ApplicationsService,
    ApplicationsResolver,
    InterviewsService,
    InterviewsResolver,
    RecruitmentReportsService,
    RecruitmentReportsResolver,
  ],
})
export class RecruitmentModule {}

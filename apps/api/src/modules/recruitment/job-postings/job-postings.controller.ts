import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CreateJobPostingDto } from "./dto/create-job-posting.dto";
import { ListJobPostingsQueryDto } from "./dto/list-job-postings-query.dto";
import { UpdateJobPostingDto } from "./dto/update-job-posting.dto";
import { JobPostingsService } from "./job-postings.service";

@ApiTags("recruitment-job-postings")
@ApiBearerAuth()
@Controller("recruitment/job-postings")
@AuditEntity("JobPosting")
export class JobPostingsController {
  constructor(private readonly jobPostingsService: JobPostingsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.RECRUITMENT_READ)
  @ApiOperation({ summary: "List job postings (paginated, filterable by status/department)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListJobPostingsQueryDto) {
    return this.jobPostingsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="job-postings.csv"')
  @ApiOperation({ summary: "Export job postings matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListJobPostingsQueryDto) {
    return this.jobPostingsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_READ)
  @ApiOperation({ summary: "Get a single job posting" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.jobPostingsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  @ApiOperation({ summary: "Create a job posting" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateJobPostingDto) {
    return this.jobPostingsService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  @ApiOperation({ summary: "Update a job posting" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateJobPostingDto) {
    return this.jobPostingsService.update(user.companyId, id, dto);
  }

  @Post(":id/close")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  @ApiOperation({ summary: "Close a job posting" })
  close(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.jobPostingsService.close(user.companyId, id);
  }

  @Post(":id/reopen")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  @ApiOperation({ summary: "Reopen a closed job posting" })
  reopen(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.jobPostingsService.reopen(user.companyId, id);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a job posting" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.jobPostingsService.remove(user.companyId, id);
  }
}

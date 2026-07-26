import { Body, Controller, Get, Header, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CompleteInterviewDto } from "./dto/complete-interview.dto";
import { CreateInterviewDto } from "./dto/create-interview.dto";
import { ListInterviewsQueryDto } from "./dto/list-interviews-query.dto";
import { UpdateInterviewDto } from "./dto/update-interview.dto";
import { InterviewsService } from "./interviews.service";

@ApiTags("recruitment-interviews")
@ApiBearerAuth()
@Controller("recruitment/interviews")
@AuditEntity("Interview")
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.RECRUITMENT_READ)
  @ApiOperation({ summary: "List interviews (paginated, filterable by application/status)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListInterviewsQueryDto) {
    return this.interviewsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="interviews.csv"')
  @ApiOperation({ summary: "Export interviews matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListInterviewsQueryDto) {
    return this.interviewsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_READ)
  @ApiOperation({ summary: "Get a single interview" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.interviewsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  @ApiOperation({ summary: "Schedule an interview for an application" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateInterviewDto) {
    return this.interviewsService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  @ApiOperation({ summary: "Reschedule a scheduled interview" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateInterviewDto) {
    return this.interviewsService.update(user.companyId, id, dto);
  }

  @Post(":id/complete")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  @ApiOperation({ summary: "Complete an interview with feedback and a rating" })
  complete(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: CompleteInterviewDto) {
    return this.interviewsService.complete(user.companyId, id, dto);
  }

  @Post(":id/cancel")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  @ApiOperation({ summary: "Cancel a scheduled interview" })
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.interviewsService.cancel(user.companyId, id);
  }
}

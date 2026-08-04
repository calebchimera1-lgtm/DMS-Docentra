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
import { ApplicationsService } from "./applications.service";
import { CreateApplicationDto } from "./dto/create-application.dto";
import { HireApplicationDto } from "./dto/hire-application.dto";
import { ListApplicationsQueryDto } from "./dto/list-applications-query.dto";
import { RejectApplicationDto } from "./dto/reject-application.dto";
import { UpdateApplicationDto } from "./dto/update-application.dto";

@ApiTags("recruitment-applications")
@ApiBearerAuth()
@Controller("recruitment/applications")
@AuditEntity("Application")
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.RECRUITMENT_READ)
  @ApiOperation({ summary: "List applications (paginated, filterable by status/job posting/candidate)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListApplicationsQueryDto) {
    return this.applicationsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="applications.csv"')
  @ApiOperation({ summary: "Export applications matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListApplicationsQueryDto) {
    return this.applicationsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_READ)
  @ApiOperation({ summary: "Get a single application" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.applicationsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  @ApiOperation({ summary: "Apply a candidate to a job posting" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateApplicationDto) {
    return this.applicationsService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  @ApiOperation({ summary: "Update an application's notes" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateApplicationDto) {
    return this.applicationsService.update(user.companyId, id, dto);
  }

  @Post(":id/screen")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  @ApiOperation({ summary: "Move an application from APPLIED to SCREENING" })
  screen(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.applicationsService.screen(user.companyId, id);
  }

  @Post(":id/interview")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  @ApiOperation({ summary: "Move an application from SCREENING to INTERVIEWING" })
  interview(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.applicationsService.moveToInterviewing(user.companyId, id);
  }

  @Post(":id/offer")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  @ApiOperation({ summary: "Move an application from INTERVIEWING to OFFERED" })
  offer(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.applicationsService.offer(user.companyId, id);
  }

  @Post(":id/reject")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  @ApiOperation({ summary: "Reject an application" })
  reject(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: RejectApplicationDto) {
    return this.applicationsService.reject(user.companyId, id, dto);
  }

  @Post(":id/withdraw")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  @ApiOperation({ summary: "Mark an application withdrawn by the candidate" })
  withdraw(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.applicationsService.withdraw(user.companyId, id);
  }

  @Post(":id/hire")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  @ApiOperation({ summary: "Hire an OFFERED application, creating an HR Employee record" })
  hire(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: HireApplicationDto) {
    return this.applicationsService.hire(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an application" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.applicationsService.remove(user.companyId, id);
  }
}

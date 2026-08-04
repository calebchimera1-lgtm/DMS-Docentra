import { Body, Controller, Get, Header, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { ListLeaveRequestsQueryDto } from "./dto/list-leave-requests-query.dto";
import { LeaveRequestsService } from "./leave-requests.service";

@ApiTags("hr-leave-requests")
@ApiBearerAuth()
@Controller("hr/leave-requests")
@AuditEntity("LeaveRequest")
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.HR_READ)
  @ApiOperation({ summary: "List leave requests (paginated, filterable by status/type/employee)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListLeaveRequestsQueryDto) {
    return this.leaveRequestsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.HR_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="leave-requests.csv"')
  @ApiOperation({ summary: "Export leave requests matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListLeaveRequestsQueryDto) {
    return this.leaveRequestsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.HR_READ)
  @ApiOperation({ summary: "Get a single leave request" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.leaveRequestsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: "Submit a leave request (starts as PENDING)" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateLeaveRequestDto) {
    return this.leaveRequestsService.create(user.companyId, dto);
  }

  @Post(":id/approve")
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: "Approve a pending leave request (requires the caller to have a linked employee profile)" })
  approve(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.leaveRequestsService.approve(user.companyId, user.id, id);
  }

  @Post(":id/reject")
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: "Reject a pending leave request (requires the caller to have a linked employee profile)" })
  reject(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.leaveRequestsService.reject(user.companyId, user.id, id);
  }

  @Post(":id/cancel")
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: "Cancel a pending leave request" })
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.leaveRequestsService.cancel(user.companyId, id);
  }
}

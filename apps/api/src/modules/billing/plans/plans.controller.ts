import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { ListPlansQueryDto } from "./dto/list-plans-query.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";
import { PlansService } from "./plans.service";

@ApiTags("billing-plans")
@ApiBearerAuth()
@Controller("billing/plans")
@AuditEntity("SubscriptionPlan")
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.BILLING_READ)
  @ApiOperation({ summary: "List subscription plans (paginated, filterable by interval/active)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListPlansQueryDto) {
    return this.plansService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.BILLING_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="subscription-plans.csv"')
  @ApiOperation({ summary: "Export plans matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListPlansQueryDto) {
    return this.plansService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.BILLING_READ)
  @ApiOperation({ summary: "Get a single plan" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.plansService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.BILLING_WRITE)
  @ApiOperation({ summary: "Create a subscription plan" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePlanDto) {
    return this.plansService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.BILLING_WRITE)
  @ApiOperation({ summary: "Edit a plan" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.BILLING_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a plan that has no subscriptions" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.plansService.remove(user.companyId, id);
  }
}

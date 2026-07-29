import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { DocumentsReportsService } from "./documents-reports.service";

@ApiTags("documents-reports")
@ApiBearerAuth()
@Controller("documents/reports")
export class DocumentsReportsController {
  constructor(private readonly reportsService: DocumentsReportsService) {}

  @Get("summary")
  @RequirePermissions(PERMISSIONS.DOCUMENTS_READ)
  @ApiOperation({ summary: "Document counts by status, plus checked-out, folder, and version totals" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Get("by-status")
  @RequirePermissions(PERMISSIONS.DOCUMENTS_READ)
  @ApiOperation({ summary: "Document counts grouped by status" })
  byStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.byStatus(user.companyId);
  }
}

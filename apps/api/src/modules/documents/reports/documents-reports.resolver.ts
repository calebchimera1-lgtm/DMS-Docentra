import { Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { DocumentsReportsService } from "./documents-reports.service";
import { DocumentsByStatusType, DocumentsSummaryType } from "./graphql/documents-summary.type";

@Resolver()
@RequirePermissions(PERMISSIONS.DOCUMENTS_READ)
export class DocumentsReportsResolver {
  constructor(private readonly reportsService: DocumentsReportsService) {}

  @Query(() => DocumentsSummaryType, { name: "documentsSummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Query(() => [DocumentsByStatusType], { name: "documentsByStatus" })
  byStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.byStatus(user.companyId);
  }
}

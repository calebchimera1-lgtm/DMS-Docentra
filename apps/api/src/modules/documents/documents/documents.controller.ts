import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CheckInDto } from "./dto/check-in.dto";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { ListDocumentsQueryDto } from "./dto/list-documents-query.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { DocumentsService } from "./documents.service";

@ApiTags("documents")
@ApiBearerAuth()
@Controller("documents/files")
@AuditEntity("Document")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DOCUMENTS_READ)
  @ApiOperation({ summary: "List documents (paginated, filterable by status/folder/checked-out)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListDocumentsQueryDto) {
    return this.documentsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.DOCUMENTS_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="documents.csv"')
  @ApiOperation({ summary: "Export documents matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListDocumentsQueryDto) {
    return this.documentsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.DOCUMENTS_READ)
  @ApiOperation({ summary: "Get a single document with its full version history" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.documentsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.DOCUMENTS_WRITE)
  @ApiOperation({ summary: "Create a document together with its first version" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateDocumentDto) {
    return this.documentsService.create(user.companyId, user.id, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.DOCUMENTS_WRITE)
  @ApiOperation({ summary: "Edit document metadata (title, folder, description)" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateDocumentDto) {
    return this.documentsService.update(user.companyId, user.id, id, dto);
  }

  @Post(":id/check-out")
  @RequirePermissions(PERMISSIONS.DOCUMENTS_WRITE)
  @ApiOperation({ summary: "Take the exclusive edit lock" })
  checkOut(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.documentsService.checkOut(user.companyId, user.id, id);
  }

  @Post(":id/check-in")
  @RequirePermissions(PERMISSIONS.DOCUMENTS_WRITE)
  @ApiOperation({ summary: "Append the next version and release the lock" })
  checkIn(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: CheckInDto) {
    return this.documentsService.checkIn(user.companyId, user.id, id, dto);
  }

  @Post(":id/cancel-check-out")
  @RequirePermissions(PERMISSIONS.DOCUMENTS_WRITE)
  @ApiOperation({ summary: "Release the lock without adding a version" })
  cancelCheckOut(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.documentsService.cancelCheckOut(user.companyId, user.id, id);
  }

  @Post(":id/publish")
  @RequirePermissions(PERMISSIONS.DOCUMENTS_WRITE)
  @ApiOperation({ summary: "Publish a draft document" })
  publish(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.documentsService.publish(user.companyId, user.id, id);
  }

  @Post(":id/archive")
  @RequirePermissions(PERMISSIONS.DOCUMENTS_WRITE)
  @ApiOperation({ summary: "Archive a document" })
  archive(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.documentsService.archive(user.companyId, user.id, id);
  }

  @Post(":id/restore")
  @RequirePermissions(PERMISSIONS.DOCUMENTS_WRITE)
  @ApiOperation({ summary: "Restore an archived document back to published" })
  restore(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.documentsService.restore(user.companyId, id);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.DOCUMENTS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a draft or archived document that is not checked out" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.documentsService.remove(user.companyId, id);
  }
}

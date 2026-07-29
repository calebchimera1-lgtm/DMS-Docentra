import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CreateFolderDto } from "./dto/create-folder.dto";
import { ListFoldersQueryDto } from "./dto/list-folders-query.dto";
import { UpdateFolderDto } from "./dto/update-folder.dto";
import { FoldersService } from "./folders.service";

@ApiTags("document-folders")
@ApiBearerAuth()
@Controller("documents/folders")
@AuditEntity("DocumentFolder")
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DOCUMENTS_READ)
  @ApiOperation({ summary: "List folders (paginated, filterable by parent or root-only)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListFoldersQueryDto) {
    return this.foldersService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.DOCUMENTS_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="document-folders.csv"')
  @ApiOperation({ summary: "Export folders matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListFoldersQueryDto) {
    return this.foldersService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.DOCUMENTS_READ)
  @ApiOperation({ summary: "Get a single folder" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.foldersService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.DOCUMENTS_WRITE)
  @ApiOperation({ summary: "Create a folder" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateFolderDto) {
    return this.foldersService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.DOCUMENTS_WRITE)
  @ApiOperation({ summary: "Rename or move a folder (rejects moves that would create a cycle)" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateFolderDto) {
    return this.foldersService.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.DOCUMENTS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an empty folder" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.foldersService.remove(user.companyId, id);
  }
}

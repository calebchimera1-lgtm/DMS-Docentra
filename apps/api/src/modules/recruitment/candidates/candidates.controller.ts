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
import { CandidatesService } from "./candidates.service";
import { CreateCandidateDto } from "./dto/create-candidate.dto";
import { ListCandidatesQueryDto } from "./dto/list-candidates-query.dto";
import { UpdateCandidateDto } from "./dto/update-candidate.dto";

@ApiTags("recruitment-candidates")
@ApiBearerAuth()
@Controller("recruitment/candidates")
@AuditEntity("Candidate")
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.RECRUITMENT_READ)
  @ApiOperation({ summary: "List candidates (paginated, searchable)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListCandidatesQueryDto) {
    return this.candidatesService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="candidates.csv"')
  @ApiOperation({ summary: "Export candidates matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListCandidatesQueryDto) {
    return this.candidatesService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_READ)
  @ApiOperation({ summary: "Get a single candidate" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.candidatesService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  @ApiOperation({ summary: "Create a candidate" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCandidateDto) {
    return this.candidatesService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_WRITE)
  @ApiOperation({ summary: "Update a candidate" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateCandidateDto) {
    return this.candidatesService.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.RECRUITMENT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a candidate" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.candidatesService.remove(user.companyId, id);
  }
}

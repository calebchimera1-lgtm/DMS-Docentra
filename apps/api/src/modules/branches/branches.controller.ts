import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../auth/interfaces/jwt-payload.interface";
import { BranchesService } from "./branches.service";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";

@ApiTags("branches")
@ApiBearerAuth()
@Controller("branches")
@RequirePermissions(PERMISSIONS.BRANCHES_MANAGE)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @ApiOperation({ summary: "List branches for the current company" })
  list(@CurrentUser() user: RequestUser) {
    return this.branchesService.list(user.companyId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single branch" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.branchesService.findOne(user.companyId, id);
  }

  @Post()
  @ApiOperation({ summary: "Create a branch (multi-branch support)" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(user.companyId, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a branch" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Deactivate a branch (must have no assigned users; HQ cannot be deleted)" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.branchesService.remove(user.companyId, id);
  }
}

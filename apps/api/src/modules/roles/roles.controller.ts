import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../auth/interfaces/jwt-payload.interface";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { RolesService } from "./roles.service";

@ApiTags("roles")
@ApiBearerAuth()
@Controller("roles")
@RequirePermissions(PERMISSIONS.ROLES_MANAGE)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: "List roles for the current company" })
  list(@CurrentUser() user: RequestUser) {
    return this.rolesService.list(user.companyId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a role and its permission assignments" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.rolesService.findOne(user.companyId, id);
  }

  @Post()
  @ApiOperation({ summary: "Create a custom role with an initial permission set" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(user.companyId, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Rename a role, or replace its permission set (system roles are immutable)" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a custom role (must have no active user grants)" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.rolesService.remove(user.companyId, id);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuthorizationService } from "../../common/authorization/authorization.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../auth/interfaces/jwt-payload.interface";
import { AssignBranchDto } from "./dto/assign-branch.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { GrantRoleDto } from "./dto/grant-role.dto";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authorization: AuthorizationService,
  ) {}

  @Get("me")
  @ApiOperation({ summary: "The current user's profile, branches, roles, and effective permissions" })
  async me(@CurrentUser() user: RequestUser) {
    const [profile, permissions] = await Promise.all([
      this.usersService.findOne(user.companyId, user.id),
      this.authorization.getEffectivePermissions(user.id),
    ]);
    return { ...profile, effectivePermissions: Array.from(permissions) };
  }

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ApiOperation({ summary: "List users in the current company (paginated, searchable, filterable)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListUsersQueryDto) {
    return this.usersService.list(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ApiOperation({ summary: "Get a single user" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.usersService.findOne(user.companyId, id);
  }

  @Get(":id/permissions")
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ApiOperation({ summary: "Effective permissions for a user (union across all their role grants)" })
  async effectivePermissions(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    await this.usersService.findOne(user.companyId, id);
    const permissions = await this.authorization.getEffectivePermissions(id);
    return { permissions: Array.from(permissions) };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_WRITE)
  @ApiOperation({ summary: "Create a new user in the current company" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.USERS_WRITE)
  @ApiOperation({ summary: "Update a user's profile or status" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.USERS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Deactivate a user (soft delete)" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.usersService.remove(user.companyId, id, user.id);
  }

  @Post(":id/branches")
  @RequirePermissions(PERMISSIONS.USERS_WRITE)
  @ApiOperation({ summary: "Grant a user access to a branch" })
  assignBranch(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: AssignBranchDto) {
    return this.usersService.assignBranch(user.companyId, id, dto);
  }

  @Delete(":id/branches/:branchId")
  @RequirePermissions(PERMISSIONS.USERS_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoke a user's access to a branch" })
  async removeBranch(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("branchId") branchId: string,
  ): Promise<void> {
    await this.usersService.removeBranch(user.companyId, id, branchId);
  }

  @Post(":id/roles")
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: "Grant a user a role, company-wide or scoped to a branch" })
  grantRole(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: GrantRoleDto) {
    return this.usersService.grantRole(user.companyId, id, dto);
  }

  @Delete(":id/roles/:userRoleId")
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoke a specific role grant from a user" })
  async revokeRole(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("userRoleId") userRoleId: string,
  ): Promise<void> {
    await this.usersService.revokeRole(user.companyId, id, userRoleId);
  }
}

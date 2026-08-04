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
import { CreateExpenseCategoryDto } from "./dto/create-expense-category.dto";
import { ListExpenseCategoriesQueryDto } from "./dto/list-expense-categories-query.dto";
import { UpdateExpenseCategoryDto } from "./dto/update-expense-category.dto";
import { ExpenseCategoriesService } from "./expense-categories.service";

@ApiTags("expenses-categories")
@ApiBearerAuth()
@Controller("expenses/categories")
@AuditEntity("ExpenseCategory")
export class ExpenseCategoriesController {
  constructor(private readonly expenseCategoriesService: ExpenseCategoriesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EXPENSES_READ)
  @ApiOperation({ summary: "List expense categories (paginated, searchable)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListExpenseCategoriesQueryDto) {
    return this.expenseCategoriesService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.EXPENSES_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="expense-categories.csv"')
  @ApiOperation({ summary: "Export expense categories matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListExpenseCategoriesQueryDto) {
    return this.expenseCategoriesService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.EXPENSES_READ)
  @ApiOperation({ summary: "Get a single expense category" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.expenseCategoriesService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EXPENSES_WRITE)
  @ApiOperation({ summary: "Create an expense category" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateExpenseCategoryDto) {
    return this.expenseCategoriesService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.EXPENSES_WRITE)
  @ApiOperation({ summary: "Update an expense category" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateExpenseCategoryDto) {
    return this.expenseCategoriesService.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.EXPENSES_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an expense category" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.expenseCategoriesService.remove(user.companyId, id);
  }
}

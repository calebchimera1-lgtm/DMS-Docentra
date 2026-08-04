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
import { ContactsService } from "./contacts.service";
import { CreateContactDto } from "./dto/create-contact.dto";
import { ListContactsQueryDto } from "./dto/list-contacts-query.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";

@ApiTags("crm-contacts")
@ApiBearerAuth()
@Controller("crm/contacts")
@AuditEntity("CrmContact")
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CRM_READ)
  @ApiOperation({ summary: "List CRM contacts (paginated, searchable)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListContactsQueryDto) {
    return this.contactsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.CRM_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="crm-contacts.csv"')
  @ApiOperation({ summary: "Export CRM contacts matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListContactsQueryDto) {
    return this.contactsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.CRM_READ)
  @ApiOperation({ summary: "Get a single CRM contact with its deals" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.contactsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  @ApiOperation({ summary: "Create a CRM contact" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateContactDto) {
    return this.contactsService.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  @ApiOperation({ summary: "Update a CRM contact" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateContactDto) {
    return this.contactsService.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.CRM_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a CRM contact" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.contactsService.remove(user.companyId, id);
  }
}

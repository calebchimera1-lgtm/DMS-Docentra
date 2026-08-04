import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ContactsService } from "./contacts.service";
import { toCrmContactType } from "./graphql/contact.mapper";
import { CrmContactType } from "./graphql/contact.type";
import { ListContactsArgs, PaginatedCrmContacts } from "./graphql/list-contacts.args";

@Resolver(() => CrmContactType)
@RequirePermissions(PERMISSIONS.CRM_READ)
export class ContactsResolver {
  constructor(private readonly contactsService: ContactsService) {}

  @Query(() => PaginatedCrmContacts, { name: "crmContacts" })
  async crmContacts(
    @CurrentUser() user: RequestUser,
    @Args() args: ListContactsArgs,
  ): Promise<PaginatedCrmContacts> {
    const result = await this.contactsService.list(user.companyId, args);
    return {
      ...result,
      items: (result.items as Parameters<typeof toCrmContactType>[0][]).map(toCrmContactType),
    };
  }

  @Query(() => CrmContactType, { name: "crmContact" })
  async crmContact(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<CrmContactType> {
    const contact = await this.contactsService.findOne(user.companyId, id);
    return toCrmContactType(contact);
  }
}

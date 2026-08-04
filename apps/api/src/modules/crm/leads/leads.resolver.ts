import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { CrmLeadStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { toCrmLeadType } from "./graphql/lead.mapper";
import { CrmLeadType } from "./graphql/lead.type";
import { ListLeadsArgs, PaginatedCrmLeads } from "./graphql/list-leads.args";
import { LeadsService } from "./leads.service";

@Resolver(() => CrmLeadType)
@RequirePermissions(PERMISSIONS.CRM_READ)
export class LeadsResolver {
  constructor(private readonly leadsService: LeadsService) {}

  @Query(() => PaginatedCrmLeads, { name: "crmLeads" })
  async crmLeads(@CurrentUser() user: RequestUser, @Args() args: ListLeadsArgs): Promise<PaginatedCrmLeads> {
    const result = await this.leadsService.list(user.companyId, {
      ...args,
      status: args.status as CrmLeadStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toCrmLeadType>[0][]).map(toCrmLeadType),
    };
  }

  @Query(() => CrmLeadType, { name: "crmLead" })
  async crmLead(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<CrmLeadType> {
    const lead = await this.leadsService.findOne(user.companyId, id);
    return toCrmLeadType(lead);
  }
}

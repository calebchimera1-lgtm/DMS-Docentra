import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { TicketPriority, TicketStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { TicketsService } from "./tickets.service";
import { ListTicketsArgs, PaginatedTickets } from "./graphql/list-tickets.args";
import { toTicketItemType } from "./graphql/ticket.mapper";
import { TicketItemType } from "./graphql/ticket.type";

@Resolver(() => TicketItemType)
@RequirePermissions(PERMISSIONS.SUPPORT_READ)
export class TicketsResolver {
  constructor(private readonly ticketsService: TicketsService) {}

  @Query(() => PaginatedTickets, { name: "tickets" })
  async tickets(
    @CurrentUser() user: RequestUser,
    @Args() args: ListTicketsArgs,
  ): Promise<PaginatedTickets> {
    const result = await this.ticketsService.list(user.companyId, {
      ...args,
      status: args.status as TicketStatus | undefined,
      priority: args.priority as TicketPriority | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toTicketItemType>[0][]).map(toTicketItemType),
    };
  }

  @Query(() => TicketItemType, { name: "ticket" })
  async ticket(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<TicketItemType> {
    const ticket = await this.ticketsService.findOne(user.companyId, id);
    return toTicketItemType(ticket);
  }
}

import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { LeaveRequestStatus, LeaveType } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { LeaveRequestsService } from "./leave-requests.service";
import { ListLeaveRequestsArgs, PaginatedLeaveRequests } from "./graphql/list-leave-requests.args";
import { toLeaveRequestItemType } from "./graphql/leave-request.mapper";
import { LeaveRequestItemType } from "./graphql/leave-request.type";

@Resolver(() => LeaveRequestItemType)
@RequirePermissions(PERMISSIONS.HR_READ)
export class LeaveRequestsResolver {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Query(() => PaginatedLeaveRequests, { name: "leaveRequests" })
  async leaveRequests(
    @CurrentUser() user: RequestUser,
    @Args() args: ListLeaveRequestsArgs,
  ): Promise<PaginatedLeaveRequests> {
    const result = await this.leaveRequestsService.list(user.companyId, {
      ...args,
      status: args.status as LeaveRequestStatus | undefined,
      type: args.type as LeaveType | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toLeaveRequestItemType>[0][]).map(toLeaveRequestItemType),
    };
  }

  @Query(() => LeaveRequestItemType, { name: "leaveRequest" })
  async leaveRequest(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<LeaveRequestItemType> {
    const leaveRequest = await this.leaveRequestsService.findOne(user.companyId, id);
    return toLeaveRequestItemType(leaveRequest);
  }
}

import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { WorkOrderStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ListWorkOrdersArgs, PaginatedWorkOrders } from "./graphql/list-work-orders.args";
import { toWorkOrderItemType } from "./graphql/work-order.mapper";
import { WorkOrderItemType } from "./graphql/work-order.type";
import { WorkOrdersService } from "./work-orders.service";

@Resolver(() => WorkOrderItemType)
@RequirePermissions(PERMISSIONS.MANUFACTURING_READ)
export class WorkOrdersResolver {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Query(() => PaginatedWorkOrders, { name: "workOrders" })
  async workOrders(
    @CurrentUser() user: RequestUser,
    @Args() args: ListWorkOrdersArgs,
  ): Promise<PaginatedWorkOrders> {
    const result = await this.workOrdersService.list(user.companyId, {
      ...args,
      status: args.status as WorkOrderStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toWorkOrderItemType>[0][]).map(toWorkOrderItemType),
    };
  }

  @Query(() => WorkOrderItemType, { name: "workOrder" })
  async workOrder(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<WorkOrderItemType> {
    const workOrder = await this.workOrdersService.findOne(user.companyId, id);
    return toWorkOrderItemType(workOrder);
  }
}

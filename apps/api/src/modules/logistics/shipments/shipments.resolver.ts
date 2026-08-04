import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { ShipmentStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ListShipmentsArgs, PaginatedShipments } from "./graphql/list-shipments.args";
import { toShipmentItemType } from "./graphql/shipment.mapper";
import { ShipmentItemType } from "./graphql/shipment.type";
import { ShipmentsService } from "./shipments.service";

@Resolver(() => ShipmentItemType)
@RequirePermissions(PERMISSIONS.LOGISTICS_READ)
export class ShipmentsResolver {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Query(() => PaginatedShipments, { name: "shipments" })
  async shipments(
    @CurrentUser() user: RequestUser,
    @Args() args: ListShipmentsArgs,
  ): Promise<PaginatedShipments> {
    const result = await this.shipmentsService.list(user.companyId, {
      ...args,
      status: args.status as ShipmentStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toShipmentItemType>[0][]).map(toShipmentItemType),
    };
  }

  @Query(() => ShipmentItemType, { name: "shipment" })
  async shipment(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ShipmentItemType> {
    const shipment = await this.shipmentsService.findOne(user.companyId, id);
    return toShipmentItemType(shipment);
  }
}

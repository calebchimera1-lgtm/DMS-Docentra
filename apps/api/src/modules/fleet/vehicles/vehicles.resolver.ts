import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { VehicleStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ListVehiclesArgs, PaginatedVehicles } from "./graphql/list-vehicles.args";
import { toVehicleItemType } from "./graphql/vehicle.mapper";
import { VehicleItemType } from "./graphql/vehicle.type";
import { VehiclesService } from "./vehicles.service";

@Resolver(() => VehicleItemType)
@RequirePermissions(PERMISSIONS.FLEET_READ)
export class VehiclesResolver {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Query(() => PaginatedVehicles, { name: "vehicles" })
  async vehicles(@CurrentUser() user: RequestUser, @Args() args: ListVehiclesArgs): Promise<PaginatedVehicles> {
    const result = await this.vehiclesService.list(user.companyId, {
      ...args,
      status: args.status as VehicleStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toVehicleItemType>[0][]).map(toVehicleItemType),
    };
  }

  @Query(() => VehicleItemType, { name: "vehicle" })
  async vehicle(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<VehicleItemType> {
    const vehicle = await this.vehiclesService.findOne(user.companyId, id);
    return toVehicleItemType(vehicle);
  }
}

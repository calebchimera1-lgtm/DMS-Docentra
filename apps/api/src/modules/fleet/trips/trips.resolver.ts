import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { TripStatus } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ListTripsArgs, PaginatedTrips } from "./graphql/list-trips.args";
import { toTripItemType } from "./graphql/trip.mapper";
import { TripItemType } from "./graphql/trip.type";
import { TripsService } from "./trips.service";

@Resolver(() => TripItemType)
@RequirePermissions(PERMISSIONS.FLEET_READ)
export class TripsResolver {
  constructor(private readonly tripsService: TripsService) {}

  @Query(() => PaginatedTrips, { name: "trips" })
  async trips(@CurrentUser() user: RequestUser, @Args() args: ListTripsArgs): Promise<PaginatedTrips> {
    const result = await this.tripsService.list(user.companyId, {
      ...args,
      status: args.status as TripStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toTripItemType>[0][]).map(toTripItemType),
    };
  }

  @Query(() => TripItemType, { name: "trip" })
  async trip(@CurrentUser() user: RequestUser, @Args("id", { type: () => ID }) id: string): Promise<TripItemType> {
    const trip = await this.tripsService.findOne(user.companyId, id);
    return toTripItemType(trip);
  }
}

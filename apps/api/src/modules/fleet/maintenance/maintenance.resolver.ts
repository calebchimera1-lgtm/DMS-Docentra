import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { MaintenanceStatus, MaintenanceType } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ListMaintenanceArgs, PaginatedMaintenance } from "./graphql/list-maintenance.args";
import { toMaintenanceItemType } from "./graphql/maintenance.mapper";
import { MaintenanceItemType } from "./graphql/maintenance.type";
import { MaintenanceService } from "./maintenance.service";

@Resolver(() => MaintenanceItemType)
@RequirePermissions(PERMISSIONS.FLEET_READ)
export class MaintenanceResolver {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Query(() => PaginatedMaintenance, { name: "maintenanceRecords" })
  async maintenanceRecords(
    @CurrentUser() user: RequestUser,
    @Args() args: ListMaintenanceArgs,
  ): Promise<PaginatedMaintenance> {
    const result = await this.maintenanceService.list(user.companyId, {
      ...args,
      status: args.status as MaintenanceStatus | undefined,
      type: args.type as MaintenanceType | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toMaintenanceItemType>[0][]).map(toMaintenanceItemType),
    };
  }

  @Query(() => MaintenanceItemType, { name: "maintenanceRecord" })
  async maintenanceRecord(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<MaintenanceItemType> {
    const record = await this.maintenanceService.findOne(user.companyId, id);
    return toMaintenanceItemType(record);
  }
}

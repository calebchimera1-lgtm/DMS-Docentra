import { Args, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { StockMovementType as PrismaStockMovementType } from "@omniflow/database";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ListMovementsArgs, PaginatedStockMovements } from "./graphql/list-movements.args";
import { toStockMovementItemType } from "./graphql/movement.mapper";
import { MovementsService } from "./movements.service";

@Resolver()
@RequirePermissions(PERMISSIONS.INVENTORY_READ)
export class MovementsResolver {
  constructor(private readonly movementsService: MovementsService) {}

  @Query(() => PaginatedStockMovements, { name: "stockMovements" })
  async stockMovements(
    @CurrentUser() user: RequestUser,
    @Args() args: ListMovementsArgs,
  ): Promise<PaginatedStockMovements> {
    const result = await this.movementsService.list(user.companyId, {
      ...args,
      type: args.type as PrismaStockMovementType | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toStockMovementItemType>[0][]).map(toStockMovementItemType),
    };
  }
}

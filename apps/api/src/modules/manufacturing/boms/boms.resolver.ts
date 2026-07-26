import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { BomsService } from "./boms.service";
import { ListBomsArgs, PaginatedBoms } from "./graphql/list-boms.args";
import { toBomItemType } from "./graphql/bom.mapper";
import { BomItemType } from "./graphql/bom.type";

@Resolver(() => BomItemType)
@RequirePermissions(PERMISSIONS.MANUFACTURING_READ)
export class BomsResolver {
  constructor(private readonly bomsService: BomsService) {}

  @Query(() => PaginatedBoms, { name: "billsOfMaterial" })
  async billsOfMaterial(@CurrentUser() user: RequestUser, @Args() args: ListBomsArgs): Promise<PaginatedBoms> {
    const result = await this.bomsService.list(user.companyId, args);
    return {
      ...result,
      items: (result.items as Parameters<typeof toBomItemType>[0][]).map(toBomItemType),
    };
  }

  @Query(() => BomItemType, { name: "billOfMaterial" })
  async billOfMaterial(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<BomItemType> {
    const bom = await this.bomsService.findOne(user.companyId, id);
    return toBomItemType(bom);
  }
}

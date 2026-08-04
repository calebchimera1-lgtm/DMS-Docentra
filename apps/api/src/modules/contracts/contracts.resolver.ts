import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { ContractStatus, ContractType } from "@omniflow/database";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../auth/interfaces/jwt-payload.interface";
import { ContractsService } from "./contracts.service";
import { ListContractsArgs, PaginatedContracts } from "./graphql/list-contracts.args";
import { toContractItemType } from "./graphql/contract.mapper";
import { ContractItemType } from "./graphql/contract.type";

@Resolver(() => ContractItemType)
@RequirePermissions(PERMISSIONS.CONTRACTS_READ)
export class ContractsResolver {
  constructor(private readonly contractsService: ContractsService) {}

  @Query(() => PaginatedContracts, { name: "contracts" })
  async contracts(@CurrentUser() user: RequestUser, @Args() args: ListContractsArgs): Promise<PaginatedContracts> {
    const result = await this.contractsService.list(user.companyId, {
      ...args,
      status: args.status as ContractStatus | undefined,
      type: args.type as ContractType | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toContractItemType>[0][]).map(toContractItemType),
    };
  }

  @Query(() => ContractItemType, { name: "contract" })
  async contract(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ContractItemType> {
    const contract = await this.contractsService.findOne(user.companyId, id);
    return toContractItemType(contract);
  }
}

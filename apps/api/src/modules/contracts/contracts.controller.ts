import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../auth/interfaces/jwt-payload.interface";
import { ContractsService } from "./contracts.service";
import { CreateContractDto } from "./dto/create-contract.dto";
import { ListContractsQueryDto } from "./dto/list-contracts-query.dto";
import { RenewContractDto } from "./dto/renew-contract.dto";
import { TerminateContractDto } from "./dto/terminate-contract.dto";
import { UpdateContractDto } from "./dto/update-contract.dto";

@ApiTags("contracts")
@ApiBearerAuth()
@Controller("contracts")
@AuditEntity("Contract")
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CONTRACTS_READ)
  @ApiOperation({ summary: "List contracts (paginated, filterable by status/type/account)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListContractsQueryDto) {
    return this.contractsService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.CONTRACTS_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="contracts.csv"')
  @ApiOperation({ summary: "Export contracts matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListContractsQueryDto) {
    return this.contractsService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.CONTRACTS_READ)
  @ApiOperation({ summary: "Get a single contract" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.contractsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CONTRACTS_WRITE)
  @ApiOperation({ summary: "Create a draft contract" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateContractDto) {
    return this.contractsService.create(user.companyId, user.id, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.CONTRACTS_WRITE)
  @ApiOperation({ summary: "Update a draft contract" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateContractDto) {
    return this.contractsService.update(user.companyId, id, dto);
  }

  @Post(":id/activate")
  @RequirePermissions(PERMISSIONS.CONTRACTS_WRITE)
  @ApiOperation({ summary: "Activate a draft contract" })
  activate(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.contractsService.activate(user.companyId, id);
  }

  @Post(":id/terminate")
  @RequirePermissions(PERMISSIONS.CONTRACTS_WRITE)
  @ApiOperation({ summary: "Terminate an active contract" })
  terminate(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: TerminateContractDto) {
    return this.contractsService.terminate(user.companyId, id, dto);
  }

  @Post(":id/expire")
  @RequirePermissions(PERMISSIONS.CONTRACTS_WRITE)
  @ApiOperation({ summary: "Mark an active contract expired" })
  expire(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.contractsService.expire(user.companyId, id);
  }

  @Post(":id/renew")
  @RequirePermissions(PERMISSIONS.CONTRACTS_WRITE)
  @ApiOperation({ summary: "Renew an active contract, creating a successor term" })
  renew(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: RenewContractDto) {
    return this.contractsService.renew(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.CONTRACTS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a draft contract" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.contractsService.remove(user.companyId, id);
  }
}

import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { PaymentProviderRegistry } from "./payment-provider.registry";

@ApiTags("billing-payment-providers")
@ApiBearerAuth()
@Controller("billing/payment-providers")
export class PaymentProvidersController {
  constructor(private readonly registry: PaymentProviderRegistry) {}

  @Get()
  @RequirePermissions(PERMISSIONS.BILLING_READ)
  @ApiOperation({ summary: "Payment providers available to collect subscription payments through" })
  list() {
    return this.registry.list().map((provider) => ({ key: provider.key, displayName: provider.displayName }));
  }
}

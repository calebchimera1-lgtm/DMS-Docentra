import { Module } from "@nestjs/common";
import { SuppliersController } from "./suppliers/suppliers.controller";
import { SuppliersResolver } from "./suppliers/suppliers.resolver";
import { SuppliersService } from "./suppliers/suppliers.service";
import { PurchaseOrdersController } from "./orders/orders.controller";
import { PurchaseOrdersResolver } from "./orders/orders.resolver";
import { PurchaseOrdersService } from "./orders/orders.service";
import { PurchaseReportsController } from "./reports/purchase-reports.controller";
import { PurchaseReportsResolver } from "./reports/purchase-reports.resolver";
import { PurchaseReportsService } from "./reports/purchase-reports.service";

@Module({
  // Order matters: PurchaseOrdersController owns "purchase/orders" and
  // SuppliersController owns "purchase/suppliers" — both are literal
  // sub-paths under "purchase", but neither controller claims the bare
  // "purchase" root, so there's no ":id" wildcard for either to shadow
  // (same collision-by-construction avoidance as the Support module).
  controllers: [SuppliersController, PurchaseOrdersController, PurchaseReportsController],
  providers: [
    SuppliersService,
    SuppliersResolver,
    PurchaseOrdersService,
    PurchaseOrdersResolver,
    PurchaseReportsService,
    PurchaseReportsResolver,
  ],
})
export class PurchaseModule {}

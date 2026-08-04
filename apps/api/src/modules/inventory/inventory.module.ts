import { Module } from "@nestjs/common";
import { WarehousesController } from "./warehouses/warehouses.controller";
import { WarehousesResolver } from "./warehouses/warehouses.resolver";
import { WarehousesService } from "./warehouses/warehouses.service";
import { StockController } from "./stock/stock.controller";
import { StockResolver } from "./stock/stock.resolver";
import { StockService } from "./stock/stock.service";
import { MovementsController } from "./movements/movements.controller";
import { MovementsResolver } from "./movements/movements.resolver";
import { MovementsService } from "./movements/movements.service";
import { InventoryReportsController } from "./reports/inventory-reports.controller";
import { InventoryReportsResolver } from "./reports/inventory-reports.resolver";
import { InventoryReportsService } from "./reports/inventory-reports.service";

@Module({
  controllers: [WarehousesController, StockController, MovementsController, InventoryReportsController],
  providers: [
    WarehousesService,
    WarehousesResolver,
    StockService,
    StockResolver,
    MovementsService,
    MovementsResolver,
    InventoryReportsService,
    InventoryReportsResolver,
  ],
})
export class InventoryModule {}

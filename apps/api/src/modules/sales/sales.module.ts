import { Module } from "@nestjs/common";
import { ProductsController } from "./products/products.controller";
import { ProductsResolver } from "./products/products.resolver";
import { ProductsService } from "./products/products.service";
import { QuotesController } from "./quotes/quotes.controller";
import { QuotesResolver } from "./quotes/quotes.resolver";
import { QuotesService } from "./quotes/quotes.service";
import { OrdersController } from "./orders/orders.controller";
import { OrdersResolver } from "./orders/orders.resolver";
import { OrdersService } from "./orders/orders.service";
import { InvoicesController } from "./invoices/invoices.controller";
import { InvoicesResolver } from "./invoices/invoices.resolver";
import { InvoicesService } from "./invoices/invoices.service";
import { SalesReportsController } from "./reports/sales-reports.controller";
import { SalesReportsResolver } from "./reports/sales-reports.resolver";
import { SalesReportsService } from "./reports/sales-reports.service";

@Module({
  controllers: [
    ProductsController,
    QuotesController,
    OrdersController,
    InvoicesController,
    SalesReportsController,
  ],
  providers: [
    ProductsService,
    ProductsResolver,
    QuotesService,
    QuotesResolver,
    OrdersService,
    OrdersResolver,
    InvoicesService,
    InvoicesResolver,
    SalesReportsService,
    SalesReportsResolver,
  ],
})
export class SalesModule {}

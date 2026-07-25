import { Module } from "@nestjs/common";
import { TicketsController } from "./tickets/tickets.controller";
import { TicketsResolver } from "./tickets/tickets.resolver";
import { TicketsService } from "./tickets/tickets.service";
import { SupportReportsController } from "./reports/support-reports.controller";
import { SupportReportsResolver } from "./reports/support-reports.resolver";
import { SupportReportsService } from "./reports/support-reports.service";

@Module({
  controllers: [TicketsController, SupportReportsController],
  providers: [TicketsService, TicketsResolver, SupportReportsService, SupportReportsResolver],
})
export class SupportModule {}

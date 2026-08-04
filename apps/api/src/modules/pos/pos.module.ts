import { Module } from "@nestjs/common";
import { SessionsController } from "./sessions/sessions.controller";
import { SessionsResolver } from "./sessions/sessions.resolver";
import { SessionsService } from "./sessions/sessions.service";
import { SalesController } from "./sales/sales.controller";
import { SalesResolver } from "./sales/sales.resolver";
import { SalesService } from "./sales/sales.service";
import { PosReportsController } from "./reports/pos-reports.controller";
import { PosReportsResolver } from "./reports/pos-reports.resolver";
import { PosReportsService } from "./reports/pos-reports.service";

@Module({
  // Sibling literal sub-paths under "pos" (sessions, sales, reports) — no
  // controller claims the bare "pos" root, so there's no ":id" wildcard for
  // any of them to shadow (same collision-avoidance-by-construction as
  // every module since Projects).
  controllers: [SessionsController, SalesController, PosReportsController],
  providers: [
    SessionsService,
    SessionsResolver,
    SalesService,
    SalesResolver,
    PosReportsService,
    PosReportsResolver,
  ],
})
export class PosModule {}

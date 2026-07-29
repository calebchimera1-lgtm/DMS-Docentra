import { Module } from "@nestjs/common";
import { PlansController } from "./plans/plans.controller";
import { PlansResolver } from "./plans/plans.resolver";
import { PlansService } from "./plans/plans.service";
import { SubscriptionsController } from "./subscriptions/subscriptions.controller";
import { SubscriptionsResolver } from "./subscriptions/subscriptions.resolver";
import { SubscriptionsService } from "./subscriptions/subscriptions.service";
import { BillingReportsController } from "./reports/billing-reports.controller";
import { BillingReportsResolver } from "./reports/billing-reports.resolver";
import { BillingReportsService } from "./reports/billing-reports.service";

@Module({
  // Sibling literal sub-paths under "billing" (plans, subscriptions,
  // reports) — no controller claims the bare "billing" root, so there is no
  // ":id" wildcard for any of them to shadow (same
  // collision-avoidance-by-construction as every module since Projects).
  controllers: [BillingReportsController, PlansController, SubscriptionsController],
  providers: [
    PlansService,
    PlansResolver,
    SubscriptionsService,
    SubscriptionsResolver,
    BillingReportsService,
    BillingReportsResolver,
  ],
})
export class BillingModule {}

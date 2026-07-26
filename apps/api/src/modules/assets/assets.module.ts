import { Module } from "@nestjs/common";
import { AssetCategoriesController } from "./asset-categories/asset-categories.controller";
import { AssetCategoriesResolver } from "./asset-categories/asset-categories.resolver";
import { AssetCategoriesService } from "./asset-categories/asset-categories.service";
import { AssetsController } from "./assets/assets.controller";
import { AssetsResolver } from "./assets/assets.resolver";
import { AssetsService } from "./assets/assets.service";
import { DepreciationRunsController } from "./depreciation-runs/depreciation-runs.controller";
import { DepreciationRunsResolver } from "./depreciation-runs/depreciation-runs.resolver";
import { DepreciationRunsService } from "./depreciation-runs/depreciation-runs.service";
import { DepreciationLinesController } from "./depreciation-lines/depreciation-lines.controller";
import { DepreciationLinesResolver } from "./depreciation-lines/depreciation-lines.resolver";
import { DepreciationLinesService } from "./depreciation-lines/depreciation-lines.service";
import { AssetsReportsController } from "./reports/assets-reports.controller";
import { AssetsReportsResolver } from "./reports/assets-reports.resolver";
import { AssetsReportsService } from "./reports/assets-reports.service";

@Module({
  // Sibling literal sub-paths under "assets" (categories, assets,
  // depreciation-runs, depreciation-lines, reports) — no controller claims
  // the bare "assets" root, so there's no ":id" wildcard for any of them to
  // shadow (same collision-avoidance-by-construction as every module since
  // Projects).
  controllers: [
    AssetCategoriesController,
    AssetsController,
    DepreciationRunsController,
    DepreciationLinesController,
    AssetsReportsController,
  ],
  providers: [
    AssetCategoriesService,
    AssetCategoriesResolver,
    AssetsService,
    AssetsResolver,
    DepreciationRunsService,
    DepreciationRunsResolver,
    DepreciationLinesService,
    DepreciationLinesResolver,
    AssetsReportsService,
    AssetsReportsResolver,
  ],
})
export class AssetsModule {}

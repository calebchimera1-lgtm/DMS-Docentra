-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'DISPOSED');

-- CreateEnum
CREATE TYPE "DepreciationRunStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "asset_categories" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "default_useful_life_months" INTEGER NOT NULL DEFAULT 36,
    "asset_account_id" TEXT,
    "depreciation_expense_account_id" TEXT,
    "accumulated_depreciation_account_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "asset_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "asset_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purchase_date" TIMESTAMP(3) NOT NULL,
    "purchase_cost_cents" INTEGER NOT NULL,
    "salvage_value_cents" INTEGER NOT NULL DEFAULT 0,
    "useful_life_months" INTEGER NOT NULL,
    "accumulated_depreciation_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "disposal_date" TIMESTAMP(3),
    "disposal_proceeds_cents" INTEGER,
    "disposal_journal_entry_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depreciation_runs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "created_by_id" TEXT,
    "period_date" TIMESTAMP(3) NOT NULL,
    "status" "DepreciationRunStatus" NOT NULL DEFAULT 'DRAFT',
    "journal_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "depreciation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depreciation_lines" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "depreciation_run_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "accumulated_after_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "depreciation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_categories_company_id_deleted_at_idx" ON "asset_categories"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "asset_categories_company_id_code_key" ON "asset_categories"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "assets_disposal_journal_entry_id_key" ON "assets"("disposal_journal_entry_id");

-- CreateIndex
CREATE INDEX "assets_company_id_deleted_at_status_idx" ON "assets"("company_id", "deleted_at", "status");

-- CreateIndex
CREATE INDEX "assets_category_id_idx" ON "assets"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "assets_company_id_asset_number_key" ON "assets"("company_id", "asset_number");

-- CreateIndex
CREATE UNIQUE INDEX "depreciation_runs_journal_entry_id_key" ON "depreciation_runs"("journal_entry_id");

-- CreateIndex
CREATE INDEX "depreciation_runs_company_id_deleted_at_status_idx" ON "depreciation_runs"("company_id", "deleted_at", "status");

-- CreateIndex
CREATE INDEX "depreciation_lines_company_id_asset_id_idx" ON "depreciation_lines"("company_id", "asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "depreciation_lines_depreciation_run_id_asset_id_key" ON "depreciation_lines"("depreciation_run_id", "asset_id");

-- AddForeignKey
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_asset_account_id_fkey" FOREIGN KEY ("asset_account_id") REFERENCES "ledger_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_depreciation_expense_account_id_fkey" FOREIGN KEY ("depreciation_expense_account_id") REFERENCES "ledger_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_accumulated_depreciation_account_id_fkey" FOREIGN KEY ("accumulated_depreciation_account_id") REFERENCES "ledger_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_disposal_journal_entry_id_fkey" FOREIGN KEY ("disposal_journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_runs" ADD CONSTRAINT "depreciation_runs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_runs" ADD CONSTRAINT "depreciation_runs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_runs" ADD CONSTRAINT "depreciation_runs_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_lines" ADD CONSTRAINT "depreciation_lines_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_lines" ADD CONSTRAINT "depreciation_lines_depreciation_run_id_fkey" FOREIGN KEY ("depreciation_run_id") REFERENCES "depreciation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_lines" ADD CONSTRAINT "depreciation_lines_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

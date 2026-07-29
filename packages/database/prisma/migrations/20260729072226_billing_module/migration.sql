-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billing_interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "trial_days" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "start_date" TIMESTAMP(3) NOT NULL,
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "trial_ends_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_invoices" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_plans_company_id_deleted_at_is_active_idx" ON "subscription_plans"("company_id", "deleted_at", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_company_id_code_key" ON "subscription_plans"("company_id", "code");

-- CreateIndex
CREATE INDEX "subscriptions_company_id_deleted_at_status_idx" ON "subscriptions"("company_id", "deleted_at", "status");

-- CreateIndex
CREATE INDEX "subscriptions_account_id_idx" ON "subscriptions"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_invoices_invoice_id_key" ON "subscription_invoices"("invoice_id");

-- CreateIndex
CREATE INDEX "subscription_invoices_subscription_id_period_start_idx" ON "subscription_invoices"("subscription_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_invoices_subscription_id_period_start_key" ON "subscription_invoices"("subscription_id", "period_start");

-- AddForeignKey
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

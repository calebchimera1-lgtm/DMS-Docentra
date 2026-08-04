-- CreateEnum
CREATE TYPE "PosSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PosSaleStatus" AS ENUM ('COMPLETED', 'VOIDED', 'REFUNDED');

-- CreateTable
CREATE TABLE "pos_register_sessions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "session_number" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "status" "PosSessionStatus" NOT NULL DEFAULT 'OPEN',
    "opening_float_cents" INTEGER NOT NULL DEFAULT 0,
    "expected_cash_cents" INTEGER,
    "counted_cash_cents" INTEGER,
    "cash_difference_cents" INTEGER,
    "opened_by_id" TEXT,
    "closed_by_id" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "pos_register_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_sales" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "sale_number" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "account_id" TEXT,
    "sold_by_id" TEXT,
    "items" JSONB NOT NULL,
    "subtotal_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "amount_tendered_cents" INTEGER,
    "change_due_cents" INTEGER,
    "status" "PosSaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "refunded_at" TIMESTAMP(3),
    "refund_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "pos_sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pos_register_sessions_company_id_deleted_at_status_idx" ON "pos_register_sessions"("company_id", "deleted_at", "status");

-- CreateIndex
CREATE INDEX "pos_register_sessions_warehouse_id_idx" ON "pos_register_sessions"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "pos_register_sessions_company_id_session_number_key" ON "pos_register_sessions"("company_id", "session_number");

-- CreateIndex
CREATE INDEX "pos_sales_company_id_deleted_at_status_idx" ON "pos_sales"("company_id", "deleted_at", "status");

-- CreateIndex
CREATE INDEX "pos_sales_session_id_idx" ON "pos_sales"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "pos_sales_company_id_sale_number_key" ON "pos_sales"("company_id", "sale_number");

-- AddForeignKey
ALTER TABLE "pos_register_sessions" ADD CONSTRAINT "pos_register_sessions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_register_sessions" ADD CONSTRAINT "pos_register_sessions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_register_sessions" ADD CONSTRAINT "pos_register_sessions_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_register_sessions" ADD CONSTRAINT "pos_register_sessions_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "pos_register_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_sold_by_id_fkey" FOREIGN KEY ("sold_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

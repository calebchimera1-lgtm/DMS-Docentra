export type LedgerAccountTypeKey = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

export interface DefaultLedgerAccount {
  code: string;
  name: string;
  type: LedgerAccountTypeKey;
}

/**
 * The starter chart of accounts every newly registered company gets,
 * created alongside its Headquarters branch and Super Admin role. Without
 * this, a fresh company has zero ledger accounts, so nothing — not Sales,
 * not Expenses, not Assets — has anywhere to post a journal entry until
 * someone manually builds a chart of accounts first.
 *
 * These codes are looked up by well-known constants below wherever a
 * module needs to post an automatic entry (e.g. Sales posting an
 * invoice's receivable) rather than asking the user to pick an account.
 * A company is free to rename, deactivate, or add to these afterwards —
 * the codes are what automatic posting relies on, not the names.
 */
export const DEFAULT_CHART_OF_ACCOUNTS: DefaultLedgerAccount[] = [
  { code: "1000", name: "Cash and Bank", type: "ASSET" },
  { code: "1100", name: "Accounts Receivable", type: "ASSET" },
  { code: "1200", name: "Inventory", type: "ASSET" },
  { code: "2000", name: "Accounts Payable", type: "LIABILITY" },
  { code: "3000", name: "Owner's Equity", type: "EQUITY" },
  { code: "4000", name: "Sales Revenue", type: "REVENUE" },
  { code: "5000", name: "Cost of Goods Sold", type: "EXPENSE" },
  { code: "5100", name: "Operating Expenses", type: "EXPENSE" },
];

export const CHART_OF_ACCOUNTS_CODES = {
  CASH: "1000",
  ACCOUNTS_RECEIVABLE: "1100",
  INVENTORY: "1200",
  ACCOUNTS_PAYABLE: "2000",
  OWNERS_EQUITY: "3000",
  SALES_REVENUE: "4000",
  COST_OF_GOODS_SOLD: "5000",
  OPERATING_EXPENSES: "5100",
} as const;

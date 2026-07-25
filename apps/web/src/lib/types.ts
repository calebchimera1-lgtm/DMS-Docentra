export interface CurrentUser {
  id: string;
  companyId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  avatarUrl: string | null;
  effectivePermissions: string[];
  branches: { branch: { id: string; name: string; code: string } }[];
  roles: { role: { id: string; name: string } }[];
}

export interface DashboardSummary {
  branchCount: number;
  activeUserCount: number;
  totalUserCount: number;
  unreadNotificationCount: number;
}

export interface ActivityByAction {
  action: string;
  count: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}

export interface LoginResult {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  mfaRequired?: true;
  mfaToken?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CrmOwnerRef {
  id: string;
  firstName: string;
  lastName: string;
}

export interface CrmAccount {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  owner: CrmOwnerRef | null;
  _count?: { contacts: number; deals: number };
  createdAt: string;
}

export interface CrmAccountDetail extends CrmAccount {
  contacts: CrmContact[];
  deals: CrmDeal[];
}

export interface CrmContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  accountId: string | null;
  account?: { id: string; name: string } | null;
  owner: CrmOwnerRef | null;
  createdAt: string;
}

export type CrmLeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "LOST";

export interface CrmLead {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  source: string | null;
  status: CrmLeadStatus;
  owner: CrmOwnerRef | null;
  createdAt: string;
}

export type CrmDealStage = "PROSPECTING" | "QUALIFICATION" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";

export interface CrmDeal {
  id: string;
  title: string;
  valueCents: number;
  currency: string;
  stage: CrmDealStage;
  expectedCloseDate: string | null;
  accountId: string | null;
  account?: { id: string; name: string } | null;
  contactId: string | null;
  contact?: { id: string; firstName: string; lastName: string } | null;
  owner: CrmOwnerRef | null;
  createdAt: string;
}

export interface CrmSummary {
  accountCount: number;
  contactCount: number;
  openLeadCount: number;
  openDealCount: number;
  openPipelineValueCents: number;
  wonValueCents: number;
}

export interface CrmPipeline {
  stages: { stage: CrmDealStage; count: number; totalValueCents: number }[];
  openPipelineValueCents: number;
  openDealCount: number;
  wonValueCents: number;
  lostValueCents: number;
}

export interface CrmComment {
  id: string;
  entityType: string;
  entityId: string;
  body: string;
  authorId: string | null;
  author: CrmOwnerRef | null;
  createdAt: string;
}

export interface CrmAttachment {
  id: string;
  entityType: string;
  entityId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unitPriceCents: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
}

export interface LineItem {
  productId?: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";

export interface Quote {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  items: LineItem[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  account: { id: string; name: string } | null;
  salesOrder?: { id: string; orderNumber: string } | null;
  createdAt: string;
}

export type SalesOrderStatus = "DRAFT" | "CONFIRMED" | "FULFILLED" | "CANCELLED";

export interface SalesOrder {
  id: string;
  orderNumber: string;
  status: SalesOrderStatus;
  items: LineItem[];
  totalCents: number;
  currency: string;
  account: { id: string; name: string } | null;
  quote?: { id: string; quoteNumber: string } | null;
  invoice?: { id: string; invoiceNumber: string } | null;
  createdAt: string;
}

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  items: LineItem[];
  totalCents: number;
  currency: string;
  dueDate: string | null;
  paidAt: string | null;
  account: { id: string; name: string } | null;
  salesOrder?: { id: string; orderNumber: string } | null;
  createdAt: string;
}

export interface SalesSummary {
  productCount: number;
  openQuoteCount: number;
  openOrderCount: number;
  revenueBookedCents: number;
  revenueCollectedCents: number;
  overdueInvoiceCount: number;
}

export interface InvoicesByStatus {
  statuses: { status: InvoiceStatus; count: number; totalCents: number }[];
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
  _count?: { stockItems: number };
  createdAt: string;
}

export interface StockItem {
  id: string;
  quantityOnHand: number;
  reorderPoint: number;
  reorderQuantity: number;
  product: { id: string; sku: string; name: string; unitPriceCents: number; currency: string };
  warehouse: { id: string; name: string; code: string };
}

export type StockMovementType = "RECEIPT" | "SALE" | "ADJUSTMENT" | "TRANSFER_IN" | "TRANSFER_OUT" | "RETURN";

export interface StockMovement {
  id: string;
  type: StockMovementType;
  quantity: number;
  reference: string | null;
  note: string | null;
  product: { id: string; sku: string; name: string };
  warehouse: { id: string; name: string; code: string };
  createdBy: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
}

export interface InventorySummary {
  warehouseCount: number;
  trackedItemCount: number;
  totalUnitsOnHand: number;
  totalStockValueCents: number;
  lowStockCount: number;
  totalMovementCount: number;
}

export interface MovementsByType {
  types: { type: StockMovementType; count: number }[];
}

export type LedgerAccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  type: LedgerAccountType;
  isActive: boolean;
}

export type JournalEntryStatus = "DRAFT" | "POSTED";

export interface JournalLine {
  id: string;
  debitCents: number;
  creditCents: number;
  description: string | null;
  ledgerAccountId: string;
  ledgerAccount: { id: string; code: string; name: string };
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  memo: string | null;
  status: JournalEntryStatus;
  lines: JournalLine[];
}

export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CARD" | "OTHER";

export interface Payment {
  id: string;
  amountCents: number;
  currency: string;
  method: PaymentMethod;
  paymentDate: string;
  reference: string | null;
  invoice: { id: string; invoiceNumber: string } | null;
  debitAccount: { id: string; code: string; name: string };
  creditAccount: { id: string; code: string; name: string };
  journalEntry: { id: string; entryNumber: string };
}

export interface AccountingSummary {
  ledgerAccountCount: number;
  draftEntryCount: number;
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  totalEquityCents: number;
  totalRevenueCents: number;
  totalExpensesCents: number;
  netIncomeCents: number;
}

export interface BalancesByType {
  types: { type: LedgerAccountType; debitCents: number; creditCents: number; balanceCents: number }[];
}

export interface HrEmployeeRef {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  manager: HrEmployeeRef | null;
}

export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN";
export type EmployeeStatus = "ACTIVE" | "ON_LEAVE" | "TERMINATED";

export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  hireDate: string;
  terminationDate: string | null;
  salaryCents: number | null;
  currency: string;
  department: { id: string; name: string; code: string } | null;
  manager: HrEmployeeRef | null;
}

export type LeaveType = "VACATION" | "SICK" | "UNPAID" | "OTHER";
export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface LeaveRequest {
  id: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  status: LeaveRequestStatus;
  reason: string | null;
  reviewedAt: string | null;
  employee: HrEmployeeRef;
  approver: HrEmployeeRef | null;
  createdAt: string;
}

export interface HrSummary {
  activeEmployeeCount: number;
  totalEmployeeCount: number;
  onLeaveCount: number;
  departmentCount: number;
  pendingLeaveRequestCount: number;
}

export interface DepartmentHeadcount {
  departmentId: string | null;
  departmentName: string;
  employeeCount: number;
}

export interface ProjectUserRef {
  id: string;
  firstName: string;
  lastName: string;
}

export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";

export interface Project {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  budgetCents: number | null;
  currency: string;
  account: { id: string; name: string } | null;
  owner: ProjectUserRef | null;
}

export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface ProjectTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  estimatedMinutes: number | null;
  project: { id: string; name: string; code: string };
  assignee: ProjectUserRef | null;
}

export interface TimeEntry {
  id: string;
  minutes: number;
  entryDate: string;
  note: string | null;
  billable: boolean;
  task: { id: string; title: string; project: { id: string; name: string; code: string } };
  user: ProjectUserRef;
}

export interface ProjectsSummary {
  activeProjectCount: number;
  totalProjectCount: number;
  openTaskCount: number;
  overdueTaskCount: number;
  totalMinutesLogged: number;
}

export interface TasksByStatus {
  status: TaskStatus;
  count: number;
}

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_ON_CUSTOMER" | "RESOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  requesterEmail: string | null;
  dueDate: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  account: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  assignee: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
}

export interface SupportSummary {
  openTicketCount: number;
  unassignedTicketCount: number;
  overdueTicketCount: number;
  totalTicketCount: number;
}

export interface TicketsByStatus {
  status: TicketStatus;
  count: number;
}

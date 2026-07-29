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

export interface Supplier {
  id: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
}

export type PurchaseOrderStatus = "DRAFT" | "SENT" | "CONFIRMED" | "RECEIVED" | "CANCELLED";

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  status: PurchaseOrderStatus;
  items: LineItem[];
  subtotalCents: number;
  totalCents: number;
  currency: string;
  expectedDate: string | null;
  supplier: { id: string; name: string; code: string };
  warehouse: { id: string; name: string; code: string } | null;
  goodsReceipt?: { id: string; receiptNumber: string } | null;
  createdAt: string;
}

export interface PurchaseSummary {
  supplierCount: number;
  openOrderCount: number;
  committedSpendCents: number;
  receivedOrderCount: number;
}

export interface PurchaseOrdersByStatus {
  status: PurchaseOrderStatus;
  count: number;
}

export type SalaryComponentType = "EARNING" | "DEDUCTION";
export type CalculationType = "FIXED" | "PERCENTAGE";

export interface SalaryComponent {
  id: string;
  name: string;
  code: string;
  type: SalaryComponentType;
  calculationType: CalculationType;
  value: number;
  isActive: boolean;
}

export type PayRunStatus = "DRAFT" | "PROCESSED" | "PAID" | "CANCELLED";

export interface PayRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  paymentDate: string | null;
  status: PayRunStatus;
  payslipCount: number;
  createdAt: string;
}

export type PayslipStatus = "PENDING" | "PAID";

export interface PayslipComponentLine {
  componentId?: string;
  name: string;
  type: SalaryComponentType;
  amountCents: number;
}

export interface Payslip {
  id: string;
  basicSalaryCents: number;
  grossPayCents: number;
  deductionsCents: number;
  netPayCents: number;
  currency: string;
  status: PayslipStatus;
  items?: PayslipComponentLine[];
  employee: { id: string; employeeNumber: string; firstName: string; lastName: string };
  payRun: { id: string; periodStart: string; periodEnd: string; status: PayRunStatus };
}

export interface PayrollSummary {
  eligibleEmployeeCount: number;
  draftPayRunCount: number;
  processedPayRunCount: number;
  totalNetPayPaidCents: number;
}

export interface PayslipsByStatus {
  status: PayslipStatus;
  count: number;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  code: string;
  ledgerAccountId: string | null;
  ledgerAccount?: { id: string; code: string; name: string } | null;
  isActive: boolean;
}

export type ExpenseClaimStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID" | "CANCELLED";

export interface ExpenseClaimLine {
  categoryId: string;
  categoryName: string;
  description: string;
  amountCents: number;
}

export interface ExpenseClaim {
  id: string;
  claimNumber: string;
  expenseDate: string;
  items: ExpenseClaimLine[];
  totalCents: number;
  currency: string;
  status: ExpenseClaimStatus;
  note: string | null;
  rejectionReason: string | null;
  journalEntry?: { id: string; entryNumber: string } | null;
  employee: { id: string; employeeNumber: string; firstName: string; lastName: string };
  approvedBy?: { id: string; employeeNumber: string; firstName: string; lastName: string } | null;
  createdAt: string;
}

export interface ExpensesSummary {
  draftClaimCount: number;
  submittedClaimCount: number;
  approvedUnpaidClaimCount: number;
  totalPaidCents: number;
}

export interface ExpenseClaimsByStatus {
  status: ExpenseClaimStatus;
  count: number;
}

export interface ExpensesByCategory {
  categoryName: string;
  totalCents: number;
}

export interface AssetCategory {
  id: string;
  name: string;
  code: string;
  defaultUsefulLifeMonths: number;
  assetAccountId: string | null;
  depreciationExpenseAccountId: string | null;
  accumulatedDepreciationAccountId: string | null;
  assetAccount?: { id: string; code: string; name: string } | null;
  depreciationExpenseAccount?: { id: string; code: string; name: string } | null;
  accumulatedDepreciationAccount?: { id: string; code: string; name: string } | null;
  isActive: boolean;
}

export type AssetStatus = "ACTIVE" | "DISPOSED";

export interface Asset {
  id: string;
  assetNumber: string;
  name: string;
  purchaseDate: string;
  purchaseCostCents: number;
  salvageValueCents: number;
  usefulLifeMonths: number;
  accumulatedDepreciationCents: number;
  currency: string;
  status: AssetStatus;
  disposalDate: string | null;
  disposalProceedsCents: number | null;
  note: string | null;
  category: { id: string; name: string; code: string };
  disposalJournalEntry?: { id: string; entryNumber: string } | null;
}

export type DepreciationRunStatus = "DRAFT" | "POSTED" | "CANCELLED";

export interface DepreciationRun {
  id: string;
  periodDate: string;
  status: DepreciationRunStatus;
  journalEntry?: { id: string; entryNumber: string } | null;
  _count: { lines: number };
}

export interface DepreciationLine {
  id: string;
  amountCents: number;
  accumulatedAfterCents: number;
  asset: { id: string; assetNumber: string; name: string };
  depreciationRun: { id: string; periodDate: string; status: DepreciationRunStatus };
}

export interface AssetsSummary {
  activeAssetCount: number;
  disposedAssetCount: number;
  totalPurchaseCostCents: number;
  totalAccumulatedDepreciationCents: number;
  totalNetBookValueCents: number;
}

export interface AssetsByCategory {
  categoryName: string;
  assetCount: number;
  netBookValueCents: number;
}

export type JobPostingStatus = "OPEN" | "ON_HOLD" | "CLOSED";

export interface JobPosting {
  id: string;
  title: string;
  description: string | null;
  employmentType: EmploymentType;
  openings: number;
  status: JobPostingStatus;
  department?: { id: string; name: string; code: string } | null;
  _count: { applications: number };
}

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  resumeUrl: string | null;
  source: string | null;
}

export type ApplicationStatus =
  | "APPLIED"
  | "SCREENING"
  | "INTERVIEWING"
  | "OFFERED"
  | "HIRED"
  | "REJECTED"
  | "WITHDRAWN";

export interface Application {
  id: string;
  status: ApplicationStatus;
  appliedAt: string;
  notes: string | null;
  rejectionReason: string | null;
  hiredEmployeeId: string | null;
  jobPosting: { id: string; title: string; status: JobPostingStatus };
  candidate: { id: string; firstName: string; lastName: string; email: string };
  hiredEmployee?: { id: string; employeeNumber: string } | null;
}

export type InterviewStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface Interview {
  id: string;
  stage: string;
  scheduledAt: string;
  status: InterviewStatus;
  feedback: string | null;
  rating: number | null;
  application: {
    id: string;
    candidate: { id: string; firstName: string; lastName: string };
    jobPosting: { id: string; title: string };
  };
  interviewer?: { id: string; employeeNumber: string; firstName: string; lastName: string } | null;
}

export interface RecruitmentSummary {
  openPostingCount: number;
  activeApplicationCount: number;
  scheduledInterviewCount: number;
  hiredCount: number;
}

export interface ApplicationsByStatus {
  status: ApplicationStatus;
  count: number;
}

export type ContractType = "SALES" | "PURCHASE" | "SERVICE" | "EMPLOYMENT" | "NDA" | "OTHER";
export type ContractStatus = "DRAFT" | "ACTIVE" | "EXPIRED" | "TERMINATED" | "RENEWED";

export interface Contract {
  id: string;
  contractNumber: string;
  title: string;
  type: ContractType;
  valueCents: number;
  currency: string;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  autoRenew: boolean;
  renewalTermMonths: number | null;
  terminatedAt: string | null;
  terminationReason: string | null;
  note: string | null;
  account?: { id: string; name: string } | null;
  owner?: { id: string; firstName: string; lastName: string } | null;
  parentContract?: { id: string; contractNumber: string } | null;
  renewedAsContract?: { id: string; contractNumber: string } | null;
}

export interface ContractsSummary {
  draftCount: number;
  activeCount: number;
  expiringSoonCount: number;
  totalActiveValueCents: number;
}

export interface ContractsByStatus {
  status: ContractStatus;
  count: number;
}

export interface BomProductRef {
  id: string;
  sku: string;
  name: string;
}

export interface BomLine {
  id: string;
  quantity: number;
  componentProduct: BomProductRef;
}

export interface Bom {
  id: string;
  name: string;
  isActive: boolean;
  note: string | null;
  product: BomProductRef;
  lines: BomLine[];
}

export type WorkOrderStatus = "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface WorkOrder {
  id: string;
  workOrderNumber: string;
  quantity: number;
  status: WorkOrderStatus;
  plannedDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  note: string | null;
  bom: { id: string; name: string };
  product: BomProductRef;
  warehouse: { id: string; name: string; code: string };
}

export interface ManufacturingSummary {
  draftCount: number;
  inProgressCount: number;
  completedCount: number;
  activeBomCount: number;
  totalCompletedQuantity: number;
}

export interface WorkOrdersByStatus {
  status: WorkOrderStatus;
  count: number;
}

export type PosSessionStatus = "OPEN" | "CLOSED";

export interface PosSession {
  id: string;
  sessionNumber: string;
  status: PosSessionStatus;
  openingFloatCents: number;
  expectedCashCents: number | null;
  countedCashCents: number | null;
  cashDifferenceCents: number | null;
  openedAt: string;
  closedAt: string | null;
  warehouse: { id: string; name: string; code: string };
  openedBy?: { id: string; firstName: string; lastName: string } | null;
  closedBy?: { id: string; firstName: string; lastName: string } | null;
  _count?: { sales: number };
}

export type PosSaleStatus = "COMPLETED" | "VOIDED" | "REFUNDED";

export interface PosSale {
  id: string;
  saleNumber: string;
  items: LineItem[];
  subtotalCents: number;
  totalCents: number;
  currency: string;
  paymentMethod: PaymentMethod;
  amountTenderedCents: number | null;
  changeDueCents: number | null;
  status: PosSaleStatus;
  voidReason: string | null;
  refundReason: string | null;
  createdAt: string;
  session: { id: string; sessionNumber: string; status?: PosSessionStatus };
  account?: { id: string; name: string } | null;
}

export interface PosSummary {
  openSessionCount: number;
  completedSaleCount: number;
  voidedCount: number;
  refundedCount: number;
  totalSalesValueCents: number;
}

export interface PosSalesByPaymentMethod {
  paymentMethod: PaymentMethod;
  count: number;
  totalCents: number;
}

export type AttendanceStatus = "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" | "ON_LEAVE";

export interface AttendanceRecord {
  id: string;
  date: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  status: AttendanceStatus;
  workedMinutes: number | null;
  note: string | null;
  employee: { id: string; employeeNumber: string; firstName: string; lastName: string };
}

export interface AttendanceSummary {
  presentCount: number;
  lateCount: number;
  absentCount: number;
  onLeaveCount: number;
  activeEmployeeCount: number;
}

export interface AttendanceByStatus {
  status: AttendanceStatus;
  count: number;
}

export type VehicleStatus = "ACTIVE" | "IN_MAINTENANCE" | "RETIRED";

export interface Vehicle {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: number | null;
  status: VehicleStatus;
  odometerReading: number;
  fuelType: string | null;
  purchaseDate: string | null;
  note: string | null;
  assignedDriver: HrEmployeeRef | null;
}

export type TripStatus = "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface Trip {
  id: string;
  purpose: string | null;
  status: TripStatus;
  startOdometer: number;
  endOdometer: number | null;
  distance: number | null;
  startedAt: string;
  endedAt: string | null;
  vehicle: { id: string; registrationNumber: string; make: string; model: string };
  driver: HrEmployeeRef | null;
}

export type MaintenanceType = "SERVICE" | "REPAIR" | "INSPECTION";
export type MaintenanceStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface MaintenanceRecord {
  id: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  scheduledDate: string;
  completedDate: string | null;
  costCents: number | null;
  description: string | null;
  vehicle: { id: string; registrationNumber: string; make: string; model: string };
}

export interface FleetSummary {
  activeCount: number;
  inMaintenanceCount: number;
  retiredCount: number;
  tripsInProgressCount: number;
  totalDistanceAllTime: number;
}

export interface VehiclesByStatus {
  status: VehicleStatus;
  count: number;
}

export type ShipmentStatus = "DRAFT" | "DISPATCHED" | "IN_TRANSIT" | "DELIVERED" | "FAILED" | "CANCELLED";

export interface DeliveryEvent {
  id: string;
  status: ShipmentStatus;
  location: string | null;
  note: string | null;
  occurredAt: string;
}

export interface Shipment {
  id: string;
  shipmentNumber: string;
  status: ShipmentStatus;
  items: LineItem[];
  destinationAddress: string;
  contactName: string | null;
  contactPhone: string | null;
  scheduledDate: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  failureReason: string | null;
  note: string | null;
  warehouse: { id: string; name: string; code: string };
  account: { id: string; name: string } | null;
  salesOrder: { id: string; orderNumber: string } | null;
  vehicle: { id: string; registrationNumber: string; make: string; model: string } | null;
  driver: HrEmployeeRef | null;
  trip: { id: string; status: TripStatus; startOdometer: number } | null;
  events: DeliveryEvent[];
}

export interface LogisticsSummary {
  draftCount: number;
  inFlightCount: number;
  deliveredCount: number;
  failedCount: number;
  totalCount: number;
  deliveredRatePercent: number;
}

export interface ShipmentsByStatus {
  status: ShipmentStatus;
  count: number;
}

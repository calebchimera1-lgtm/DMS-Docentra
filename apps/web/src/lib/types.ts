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

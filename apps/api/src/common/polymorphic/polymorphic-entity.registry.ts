import { PERMISSIONS, type PermissionKey } from "@omniflow/shared";
import type { PrismaService } from "../../prisma/prisma.service";

export interface PolymorphicEntityDefinition {
  /** Permission required to read comments/attachments filed against this entity type. */
  readPermission: PermissionKey;
  /** Permission required to create/delete comments/attachments filed against this entity type. */
  writePermission: PermissionKey;
  /** Prisma delegate used to verify entityId actually exists (and belongs to the caller's company) before accepting a write. */
  model: (prisma: PrismaService) => { count: (args: { where: { id: string; companyId: string } }) => Promise<number> };
}

/**
 * Single source of truth mapping the free-text `entityType` used by the
 * generic Comments/Attachments modules to the module permission that
 * should gate access to it. Anything not listed here is rejected, so a
 * comment/attachment can never be filed against an unrecognized or
 * mistyped entity type.
 */
export const POLYMORPHIC_ENTITY_REGISTRY: Record<string, PolymorphicEntityDefinition> = {
  CrmAccount: { readPermission: PERMISSIONS.CRM_READ, writePermission: PERMISSIONS.CRM_WRITE, model: (p) => p.crmAccount },
  CrmContact: { readPermission: PERMISSIONS.CRM_READ, writePermission: PERMISSIONS.CRM_WRITE, model: (p) => p.crmContact },
  CrmLead: { readPermission: PERMISSIONS.CRM_READ, writePermission: PERMISSIONS.CRM_WRITE, model: (p) => p.crmLead },
  CrmDeal: { readPermission: PERMISSIONS.CRM_READ, writePermission: PERMISSIONS.CRM_WRITE, model: (p) => p.crmDeal },
  Quote: { readPermission: PERMISSIONS.SALES_READ, writePermission: PERMISSIONS.SALES_WRITE, model: (p) => p.quote },
  SalesOrder: { readPermission: PERMISSIONS.SALES_READ, writePermission: PERMISSIONS.SALES_WRITE, model: (p) => p.salesOrder },
  Invoice: { readPermission: PERMISSIONS.SALES_READ, writePermission: PERMISSIONS.SALES_WRITE, model: (p) => p.invoice },
  Product: { readPermission: PERMISSIONS.SALES_READ, writePermission: PERMISSIONS.SALES_WRITE, model: (p) => p.product },
  Warehouse: { readPermission: PERMISSIONS.INVENTORY_READ, writePermission: PERMISSIONS.INVENTORY_WRITE, model: (p) => p.warehouse },
  JournalEntry: { readPermission: PERMISSIONS.ACCOUNTING_READ, writePermission: PERMISSIONS.ACCOUNTING_WRITE, model: (p) => p.journalEntry },
  Payment: { readPermission: PERMISSIONS.ACCOUNTING_READ, writePermission: PERMISSIONS.ACCOUNTING_WRITE, model: (p) => p.payment },
  Employee: { readPermission: PERMISSIONS.HR_READ, writePermission: PERMISSIONS.HR_WRITE, model: (p) => p.employee },
  LeaveRequest: { readPermission: PERMISSIONS.HR_READ, writePermission: PERMISSIONS.HR_WRITE, model: (p) => p.leaveRequest },
  Project: { readPermission: PERMISSIONS.PROJECTS_READ, writePermission: PERMISSIONS.PROJECTS_WRITE, model: (p) => p.project },
  ProjectTask: { readPermission: PERMISSIONS.PROJECTS_READ, writePermission: PERMISSIONS.PROJECTS_WRITE, model: (p) => p.projectTask },
  Ticket: { readPermission: PERMISSIONS.SUPPORT_READ, writePermission: PERMISSIONS.SUPPORT_WRITE, model: (p) => p.ticket },
  Supplier: { readPermission: PERMISSIONS.PURCHASE_READ, writePermission: PERMISSIONS.PURCHASE_WRITE, model: (p) => p.supplier },
  PurchaseOrder: { readPermission: PERMISSIONS.PURCHASE_READ, writePermission: PERMISSIONS.PURCHASE_WRITE, model: (p) => p.purchaseOrder },
  PayRun: { readPermission: PERMISSIONS.PAYROLL_READ, writePermission: PERMISSIONS.PAYROLL_WRITE, model: (p) => p.payRun },
  ExpenseClaim: { readPermission: PERMISSIONS.EXPENSES_READ, writePermission: PERMISSIONS.EXPENSES_WRITE, model: (p) => p.expenseClaim },
  Asset: { readPermission: PERMISSIONS.ASSETS_READ, writePermission: PERMISSIONS.ASSETS_WRITE, model: (p) => p.asset },
  JobPosting: { readPermission: PERMISSIONS.RECRUITMENT_READ, writePermission: PERMISSIONS.RECRUITMENT_WRITE, model: (p) => p.jobPosting },
  Candidate: { readPermission: PERMISSIONS.RECRUITMENT_READ, writePermission: PERMISSIONS.RECRUITMENT_WRITE, model: (p) => p.candidate },
  Application: { readPermission: PERMISSIONS.RECRUITMENT_READ, writePermission: PERMISSIONS.RECRUITMENT_WRITE, model: (p) => p.application },
  Contract: { readPermission: PERMISSIONS.CONTRACTS_READ, writePermission: PERMISSIONS.CONTRACTS_WRITE, model: (p) => p.contract },
  WorkOrder: { readPermission: PERMISSIONS.MANUFACTURING_READ, writePermission: PERMISSIONS.MANUFACTURING_WRITE, model: (p) => p.workOrder },
  PosSale: { readPermission: PERMISSIONS.POS_READ, writePermission: PERMISSIONS.POS_WRITE, model: (p) => p.posSale },
  Vehicle: { readPermission: PERMISSIONS.FLEET_READ, writePermission: PERMISSIONS.FLEET_WRITE, model: (p) => p.vehicle },
  Trip: { readPermission: PERMISSIONS.FLEET_READ, writePermission: PERMISSIONS.FLEET_WRITE, model: (p) => p.trip },
  Shipment: { readPermission: PERMISSIONS.LOGISTICS_READ, writePermission: PERMISSIONS.LOGISTICS_WRITE, model: (p) => p.shipment },
  Document: { readPermission: PERMISSIONS.DOCUMENTS_READ, writePermission: PERMISSIONS.DOCUMENTS_WRITE, model: (p) => p.document },
  Subscription: { readPermission: PERMISSIONS.BILLING_READ, writePermission: PERMISSIONS.BILLING_WRITE, model: (p) => p.subscription },
};

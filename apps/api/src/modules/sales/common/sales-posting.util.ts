import { CHART_OF_ACCOUNTS_CODES } from "@omniflow/shared";
import type { Prisma } from "@omniflow/database";
import { formatDocumentNumber } from "./document-number.util";

/**
 * Posts the Accounts Receivable / Sales Revenue side of an invoice: Dr
 * Accounts Receivable, Cr Sales Revenue, for the invoice total. Must run
 * inside the same transaction that creates the invoice, so an invoice and
 * its receivable either both exist or neither does.
 *
 * If the company's chart of accounts doesn't have the well-known
 * Accounts Receivable/Sales Revenue codes (predates auto-provisioning, or
 * the accounts were renamed/removed), this silently does nothing rather
 * than blocking the sale — Sales still works standalone, it just doesn't
 * reach into Accounting for a company that isn't using it.
 *
 * Cost of Goods Sold is deliberately not posted here: Product has no
 * cost/COGS field yet (a separate, already-tracked gap), so there is no
 * unit cost to post against Inventory/COGS without fabricating one.
 */
export async function postInvoiceReceivable(
  tx: Prisma.TransactionClient,
  companyId: string,
  invoiceNumber: string,
  totalCents: number,
): Promise<void> {
  if (totalCents <= 0) {
    return;
  }

  const [receivable, revenue] = await Promise.all([
    tx.ledgerAccount.findFirst({
      where: { companyId, code: CHART_OF_ACCOUNTS_CODES.ACCOUNTS_RECEIVABLE, deletedAt: null },
    }),
    tx.ledgerAccount.findFirst({
      where: { companyId, code: CHART_OF_ACCOUNTS_CODES.SALES_REVENUE, deletedAt: null },
    }),
  ]);
  if (!receivable || !revenue) {
    return;
  }

  const entryCount = await tx.journalEntry.count({ where: { companyId } });
  await tx.journalEntry.create({
    data: {
      companyId,
      entryNumber: formatDocumentNumber("JE", entryCount),
      entryDate: new Date(),
      memo: `Invoice ${invoiceNumber}`,
      status: "POSTED",
      lines: {
        create: [
          {
            ledgerAccountId: receivable.id,
            debitCents: totalCents,
            creditCents: 0,
            description: `${invoiceNumber}: accounts receivable`,
            lineOrder: 0,
          },
          {
            ledgerAccountId: revenue.id,
            debitCents: 0,
            creditCents: totalCents,
            description: `${invoiceNumber}: sales revenue`,
            lineOrder: 1,
          },
        ],
      },
    },
  });
}

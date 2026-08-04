import { Module } from "@nestjs/common";
import { LedgerAccountsController } from "./ledger-accounts/ledger-accounts.controller";
import { LedgerAccountsResolver } from "./ledger-accounts/ledger-accounts.resolver";
import { LedgerAccountsService } from "./ledger-accounts/ledger-accounts.service";
import { JournalEntriesController } from "./journal-entries/journal-entries.controller";
import { JournalEntriesResolver } from "./journal-entries/journal-entries.resolver";
import { JournalEntriesService } from "./journal-entries/journal-entries.service";
import { PaymentsController } from "./payments/payments.controller";
import { PaymentsResolver } from "./payments/payments.resolver";
import { PaymentsService } from "./payments/payments.service";
import { AccountingReportsController } from "./reports/accounting-reports.controller";
import { AccountingReportsResolver } from "./reports/accounting-reports.resolver";
import { AccountingReportsService } from "./reports/accounting-reports.service";

@Module({
  controllers: [
    LedgerAccountsController,
    JournalEntriesController,
    PaymentsController,
    AccountingReportsController,
  ],
  providers: [
    LedgerAccountsService,
    LedgerAccountsResolver,
    JournalEntriesService,
    JournalEntriesResolver,
    PaymentsService,
    PaymentsResolver,
    AccountingReportsService,
    AccountingReportsResolver,
  ],
})
export class AccountingModule {}

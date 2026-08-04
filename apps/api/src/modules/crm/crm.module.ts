import { Module } from "@nestjs/common";
import { AccountsController } from "./accounts/accounts.controller";
import { AccountsResolver } from "./accounts/accounts.resolver";
import { AccountsService } from "./accounts/accounts.service";
import { ContactsController } from "./contacts/contacts.controller";
import { ContactsResolver } from "./contacts/contacts.resolver";
import { ContactsService } from "./contacts/contacts.service";
import { LeadsController } from "./leads/leads.controller";
import { LeadsResolver } from "./leads/leads.resolver";
import { LeadsService } from "./leads/leads.service";
import { DealsController } from "./deals/deals.controller";
import { DealsResolver } from "./deals/deals.resolver";
import { DealsService } from "./deals/deals.service";
import { CrmReportsController } from "./reports/crm-reports.controller";
import { CrmReportsResolver } from "./reports/crm-reports.resolver";
import { CrmReportsService } from "./reports/crm-reports.service";

@Module({
  controllers: [AccountsController, ContactsController, LeadsController, DealsController, CrmReportsController],
  providers: [
    AccountsService,
    AccountsResolver,
    ContactsService,
    ContactsResolver,
    LeadsService,
    LeadsResolver,
    DealsService,
    DealsResolver,
    CrmReportsService,
    CrmReportsResolver,
  ],
})
export class CrmModule {}

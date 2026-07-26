import { join } from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { GraphQLModule } from "@nestjs/graphql";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuditInterceptor } from "./common/audit/audit.interceptor";
import { AuthorizationModule } from "./common/authorization/authorization.module";
import { CryptoModule } from "./common/crypto/crypto.module";
import { AppThrottlerGuard } from "./common/guards/throttler.guard";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { StorageModule } from "./common/storage/storage.module";
import { AccountingModule } from "./modules/accounting/accounting.module";
import { AssetsModule } from "./modules/assets/assets.module";
import { AttachmentsModule } from "./modules/attachments/attachments.module";
import { AttendanceModule } from "./modules/attendance/attendance.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BranchesModule } from "./modules/branches/branches.module";
import { CommentsModule } from "./modules/comments/comments.module";
import { ContractsModule } from "./modules/contracts/contracts.module";
import { CrmModule } from "./modules/crm/crm.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { ExpensesModule } from "./modules/expenses/expenses.module";
import { HealthModule } from "./modules/health/health.module";
import { HrModule } from "./modules/hr/hr.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { ManufacturingModule } from "./modules/manufacturing/manufacturing.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { PayrollModule } from "./modules/payroll/payroll.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { PluginsModule } from "./modules/plugins/plugins.module";
import { PosModule } from "./modules/pos/pos.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { PurchaseModule } from "./modules/purchase/purchase.module";
import { RecruitmentModule } from "./modules/recruitment/recruitment.module";
import { RolesModule } from "./modules/roles/roles.module";
import { SalesModule } from "./modules/sales/sales.module";
import { SupportModule } from "./modules/support/support.module";
import { UsersModule } from "./modules/users/users.module";
import { JobsModule } from "./jobs/jobs.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RealtimeModule } from "./realtime/realtime.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env"],
    }),
    EventEmitterModule.forRoot(),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      path: "/api/v1/graphql",
      autoSchemaFile: join(process.cwd(), "src/schema.gql"),
      sortSchema: true,
      context: ({ req, res }: { req: unknown; res: unknown }) => ({ req, res }),
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
    }),
    PrismaModule,
    CryptoModule,
    StorageModule,
    JobsModule,
    AuthorizationModule,
    AuthModule,
    PermissionsModule,
    UsersModule,
    RolesModule,
    BranchesModule,
    DashboardModule,
    NotificationsModule,
    AttachmentsModule,
    CommentsModule,
    PluginsModule,
    RealtimeModule,
    HealthModule,
    // Business modules (CRM, Sales, Inventory, ...) are added one at a
    // time starting in Milestone 7 — see docs/architecture.
    CrmModule,
    SalesModule,
    InventoryModule,
    AccountingModule,
    HrModule,
    ProjectsModule,
    SupportModule,
    PurchaseModule,
    PayrollModule,
    ExpensesModule,
    AssetsModule,
    RecruitmentModule,
    ContractsModule,
    ManufacturingModule,
    PosModule,
    AttendanceModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}

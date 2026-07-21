import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { QUEUE_MAINTENANCE, QUEUE_WEBHOOKS } from "@omniflow/shared";
import { MaintenanceProcessor } from "./processors/maintenance.processor";
import { WebhooksProcessor } from "./processors/webhooks.processor";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env"] }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.get("REDIS_URL", "redis://localhost:6379"));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: QUEUE_MAINTENANCE }, { name: QUEUE_WEBHOOKS }),
    PrismaModule,
  ],
  providers: [MaintenanceProcessor, WebhooksProcessor],
})
export class AppModule {}

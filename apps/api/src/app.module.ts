import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env"],
    }),
    HealthModule,
    // Feature modules (auth, users, companies, ...) are added starting in
    // Milestone 3 — see docs/architecture for the module roadmap.
  ],
})
export class AppModule {}

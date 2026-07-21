import "dotenv/config";
import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const logger = new Logger("Bootstrap");

async function bootstrap(): Promise<void> {
  // A pure background worker — no HTTP server, just BullMQ processors.
  await NestFactory.createApplicationContext(AppModule);
  logger.log("Omniflow worker started, processing jobs from Redis");
}

bootstrap();

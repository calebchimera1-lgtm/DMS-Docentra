import "dotenv/config";
import "reflect-metadata";
import compression from "compression";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";

function resolveCorsOrigins(): boolean | string[] {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) {
    // No origin configured — fine for local dev, but every production
    // deployment should set CORS_ORIGIN explicitly (see .env.example).
    return true;
  }
  return raw.split(",").map((origin) => origin.trim());
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: { origin: resolveCorsOrigins(), credentials: true } });

  app.use(helmet());
  app.use(compression());
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Omniflow API")
    .setDescription("Omniflow ERP platform — REST API reference")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, swaggerDocument);

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  console.log(`Omniflow API listening on port ${port}`);
}

bootstrap();

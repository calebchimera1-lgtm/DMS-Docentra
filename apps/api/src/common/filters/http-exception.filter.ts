import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";

/**
 * Preserves Nest's default REST error shape (`{ statusCode, message,
 * error }`, exactly what HttpException.getResponse() already produces)
 * — the web app's ApiError parsing (apps/web/src/lib/api-client.ts) and
 * every e2e test already assume it. What this filter adds on top:
 * centralized logging for 5xx responses, and a guaranteed-generic
 * message for anything that isn't a deliberately-thrown HttpException
 * (never echo a raw internal error message back to the client).
 * GraphQL errors are untouched — Apollo has its own envelope.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType<"http" | "graphql">() !== "http") {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(exception.message, exception.stack);
      }
      response.status(status).json(exception.getResponse());
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.message : "Unknown error",
      exception instanceof Error ? exception.stack : undefined,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
      error: "Internal Server Error",
    });
  }
}

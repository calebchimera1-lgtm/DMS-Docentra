import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { Observable, mergeMap } from "rxjs";
import type { AuditAction } from "@omniflow/database";
import { AUDIT_ENTITY_KEY } from "../decorators/audit-entity.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../modules/auth/interfaces/jwt-payload.interface";

const METHOD_TO_ACTION: Partial<Record<string, AuditAction>> = {
  POST: "CREATE",
  PUT: "UPDATE",
  PATCH: "UPDATE",
  DELETE: "DELETE",
};

/**
 * Applied globally. Routes opt in by decorating their controller (or an
 * individual handler) with @AuditEntity('EntityName') — everything else
 * passes through untouched. Keeps modules from having to hand-write
 * `prisma.auditLog.create(...)` calls the way AuthService still does for
 * auth-specific events (login/logout/password reset) that don't map
 * cleanly to a CRUD verb.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const entityType = this.reflector.getAllAndOverride<string | undefined>(AUDIT_ENTITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const action = entityType ? METHOD_TO_ACTION[context.switchToHttp().getRequest<Request>().method] : undefined;

    if (!entityType || !action) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = request.user;
    if (!user) {
      return next.handle();
    }

    return next.handle().pipe(
      // mergeMap (not tap) so the response waits for the audit write to
      // settle — an audit trail that might not exist yet by the time the
      // client acts on the response isn't trustworthy. Errors are caught
      // rather than propagated: audit logging is best-effort and must
      // never fail the request it's describing.
      mergeMap(async (result) => {
        const entityId = this.extractEntityId(result, request.params);
        try {
          await this.prisma.auditLog.create({
            data: {
              companyId: user.companyId,
              actorId: user.id,
              action,
              entityType,
              entityId,
              ipAddress: request.ip,
              userAgent: request.headers["user-agent"],
            },
          });
        } catch (error) {
          this.logger.error(`Failed to write audit log for ${entityType}`, error);
        }
        return result;
      }),
    );
  }

  private extractEntityId(result: unknown, params: Record<string, string | string[]>): string | null {
    if (result && typeof result === "object" && "id" in result && typeof result.id === "string") {
      return result.id;
    }
    const id = params.id;
    return typeof id === "string" ? id : null;
  }
}

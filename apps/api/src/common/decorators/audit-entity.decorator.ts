import { SetMetadata } from "@nestjs/common";

export const AUDIT_ENTITY_KEY = "auditEntity";

/**
 * Marks a controller (or a single route, to override the class-level
 * value) as subject to automatic audit logging. AuditInterceptor infers
 * the action from the HTTP method (POST → CREATE, PATCH/PUT → UPDATE,
 * DELETE → DELETE; GET is never logged) and the entity id from the
 * response body or the `:id` route param.
 */
export const AuditEntity = (entityType: string) => SetMetadata(AUDIT_ENTITY_KEY, entityType);

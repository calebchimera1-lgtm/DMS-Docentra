import { ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { Request } from "express";
import type { RequestUser } from "../../modules/auth/interfaces/jwt-payload.interface";

/** Injects the authenticated user (set by JwtAuthGuard) into a handler. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser => {
  const request = ctx.switchToHttp().getRequest<Request & { user: RequestUser }>();
  return request.user;
});

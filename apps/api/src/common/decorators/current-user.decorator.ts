import { ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { Request } from "express";
import { getRequestFromContext } from "../utils/execution-context.util";
import type { RequestUser } from "../../modules/auth/interfaces/jwt-payload.interface";

/** Injects the authenticated user (set by JwtAuthGuard) into a handler — REST or GraphQL. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser => {
  const request = getRequestFromContext(ctx) as Request & { user: RequestUser };
  return request.user;
});

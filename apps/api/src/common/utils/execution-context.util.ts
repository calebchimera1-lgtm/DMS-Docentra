import { ExecutionContext } from "@nestjs/common";
import { GqlContextType, GqlExecutionContext } from "@nestjs/graphql";
import type { Request } from "express";

/**
 * Every guard/decorator that reads the request (for the JWT, the
 * current user, etc.) needs to work whether the call arrived over REST
 * or GraphQL — Nest's ExecutionContext wraps each transport differently.
 * This is the one place that distinction is handled.
 */
export function getRequestFromContext(context: ExecutionContext): Request {
  if (context.getType<GqlContextType>() === "graphql") {
    return GqlExecutionContext.create(context).getContext<{ req: Request }>().req;
  }
  return context.switchToHttp().getRequest<Request>();
}

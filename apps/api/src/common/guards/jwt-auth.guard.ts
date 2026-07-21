import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { getRequestFromContext } from "../utils/execution-context.util";

/**
 * Applied globally (see AppModule) so every route — REST or GraphQL —
 * requires a valid access token by default. Opt out per-route/controller
 * with @Public() (REST only; every GraphQL operation currently requires
 * auth, so there's no @Public() usage there yet).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt-access") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  override getRequest(context: ExecutionContext): Request {
    return getRequestFromContext(context);
  }
}

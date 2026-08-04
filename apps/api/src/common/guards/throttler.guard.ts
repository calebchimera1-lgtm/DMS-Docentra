import { ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { GqlContextType, GqlExecutionContext } from "@nestjs/graphql";

/**
 * @nestjs/throttler's default guard only knows how to pull the request/
 * response out of an HTTP ExecutionContext — GraphQL operations go
 * through the same global guard, so it needs the same REST/GraphQL
 * branching as JwtAuthGuard and PermissionsGuard.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override getRequestResponse(context: ExecutionContext) {
    if (context.getType<GqlContextType>() === "graphql") {
      const gqlCtx = GqlExecutionContext.create(context).getContext<{ req: unknown; res: unknown }>();
      return { req: gqlCtx.req, res: gqlCtx.res };
    }
    const http = context.switchToHttp();
    return { req: http.getRequest(), res: http.getResponse() };
  }
}

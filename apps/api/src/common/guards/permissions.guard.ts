import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { PermissionKey } from "@omniflow/shared";
import { AuthorizationService } from "../authorization/authorization.service";
import { PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";
import { getRequestFromContext } from "../utils/execution-context.util";
import type { RequestUser } from "../../modules/auth/interfaces/jwt-payload.interface";

/**
 * Applied globally alongside JwtAuthGuard. Routes without @RequirePermissions
 * are unaffected (just need a valid access token, enforced upstream);
 * @Public() routes never reach here with a req.user at all, so there's
 * nothing to check.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionKey[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const request = getRequestFromContext(context) as unknown as { user?: RequestUser };
    if (!request.user) {
      return false;
    }

    const effective = await this.authorization.getEffectivePermissions(request.user.id);
    const missing = required.filter((key) => !effective.has(key));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing required permission(s): ${missing.join(", ")}`);
    }
    return true;
  }
}

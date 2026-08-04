import { SetMetadata } from "@nestjs/common";
import type { PermissionKey } from "@omniflow/shared";

export const PERMISSIONS_KEY = "requiredPermissions";

/** Requires the current user's effective permissions to include every key listed. */
export const RequirePermissions = (...keys: PermissionKey[]) => SetMetadata(PERMISSIONS_KEY, keys);

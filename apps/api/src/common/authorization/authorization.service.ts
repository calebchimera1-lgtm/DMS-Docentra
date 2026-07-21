import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * All permission keys granted to a user across every role they hold,
   * company-wide or branch-scoped alike. Row-level enforcement of "only
   * within that branch" is a further refinement left for a later pass —
   * today a granted permission applies wherever the user operates.
   */
  async getEffectivePermissions(userId: string): Promise<Set<string>> {
    const grants = await this.prisma.userRole.findMany({
      where: { userId },
      select: {
        role: {
          select: {
            permissions: { select: { permission: { select: { key: true } } } },
          },
        },
      },
    });

    const keys = new Set<string>();
    for (const grant of grants) {
      for (const rolePermission of grant.role.permissions) {
        keys.add(rolePermission.permission.key);
      }
    }
    return keys;
  }
}

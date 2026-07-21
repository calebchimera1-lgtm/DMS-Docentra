import type { RoleType } from "./role.type";

interface PrismaRoleWithRelations {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: { permission: { id: string; key: string; module: string; action: string } }[];
}

export function toRoleType(role: PrismaRoleWithRelations): RoleType {
  return {
    id: role.id,
    name: role.name,
    description: role.description ?? undefined,
    isSystem: role.isSystem,
    permissions: role.permissions.map((p) => p.permission),
  };
}

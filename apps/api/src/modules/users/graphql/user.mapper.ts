import type { UserType } from "./user.type";

interface PrismaUserWithRelations {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  branches: { branch: { id: string; name: string; code: string } }[];
  roles: { role: { id: string; name: string } }[];
}

export function toUserType(user: PrismaUserWithRelations): UserType {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    branches: user.branches.map((b) => b.branch),
    roles: user.roles.map((r) => r.role),
  };
}

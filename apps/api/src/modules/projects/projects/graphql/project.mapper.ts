import type { ProjectItemType } from "./project.type";

interface PrismaProjectWithRelations {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  budgetCents: number | null;
  currency: string;
  account: { id: string; name: string } | null;
  owner: { id: string; firstName: string; lastName: string } | null;
}

export function toProjectItemType(project: PrismaProjectWithRelations): ProjectItemType {
  return {
    id: project.id,
    name: project.name,
    code: project.code,
    description: project.description ?? undefined,
    status: project.status,
    startDate: project.startDate ?? undefined,
    endDate: project.endDate ?? undefined,
    budgetCents: project.budgetCents ?? undefined,
    currency: project.currency,
    account: project.account ?? undefined,
    owner: project.owner ?? undefined,
  };
}

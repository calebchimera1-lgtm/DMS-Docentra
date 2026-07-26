import type { JobPostingItemType } from "./job-posting.type";

interface PrismaJobPostingWithRelations {
  id: string;
  title: string;
  employmentType: string;
  openings: number;
  status: string;
  department: { id: string; name: string; code: string } | null;
  _count: { applications: number };
}

export function toJobPostingItemType(posting: PrismaJobPostingWithRelations): JobPostingItemType {
  return {
    id: posting.id,
    title: posting.title,
    employmentType: posting.employmentType,
    openings: posting.openings,
    applicationCount: posting._count.applications,
    status: posting.status,
    department: posting.department ?? undefined,
  };
}

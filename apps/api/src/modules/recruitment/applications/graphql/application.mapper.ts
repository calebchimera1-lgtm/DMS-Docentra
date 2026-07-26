import type { ApplicationItemType } from "./application.type";

interface PrismaApplicationWithRelations {
  id: string;
  status: string;
  appliedAt: Date;
  notes: string | null;
  rejectionReason: string | null;
  jobPosting: { id: string; title: string; status: string };
  candidate: { id: string; firstName: string; lastName: string; email: string };
}

export function toApplicationItemType(application: PrismaApplicationWithRelations): ApplicationItemType {
  return {
    id: application.id,
    status: application.status,
    appliedAt: application.appliedAt,
    notes: application.notes ?? undefined,
    rejectionReason: application.rejectionReason ?? undefined,
    jobPosting: application.jobPosting,
    candidate: application.candidate,
  };
}

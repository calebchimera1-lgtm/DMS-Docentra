import type { InterviewItemType } from "./interview.type";

interface PrismaInterviewWithRelations {
  id: string;
  stage: string;
  scheduledAt: Date;
  status: string;
  feedback: string | null;
  rating: number | null;
  application: {
    id: string;
    candidate: { firstName: string; lastName: string };
    jobPosting: { title: string };
  };
  interviewer: { id: string; firstName: string; lastName: string } | null;
}

export function toInterviewItemType(interview: PrismaInterviewWithRelations): InterviewItemType {
  return {
    id: interview.id,
    stage: interview.stage,
    scheduledAt: interview.scheduledAt,
    status: interview.status,
    feedback: interview.feedback ?? undefined,
    rating: interview.rating ?? undefined,
    application: {
      id: interview.application.id,
      candidateName: `${interview.application.candidate.firstName} ${interview.application.candidate.lastName}`,
      jobPostingTitle: interview.application.jobPosting.title,
    },
    interviewer: interview.interviewer ?? undefined,
  };
}

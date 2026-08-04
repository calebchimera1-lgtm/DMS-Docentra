import type { CandidateItemType } from "./candidate.type";

interface PrismaCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  source: string | null;
}

export function toCandidateItemType(candidate: PrismaCandidate): CandidateItemType {
  return {
    id: candidate.id,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    email: candidate.email,
    phone: candidate.phone ?? undefined,
    source: candidate.source ?? undefined,
  };
}

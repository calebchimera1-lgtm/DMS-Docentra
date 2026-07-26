import type { DepreciationRunItemType } from "./depreciation-run.type";

interface PrismaDepreciationRunWithCount {
  id: string;
  periodDate: Date;
  status: string;
  _count: { lines: number };
}

export function toDepreciationRunItemType(run: PrismaDepreciationRunWithCount): DepreciationRunItemType {
  return {
    id: run.id,
    periodDate: run.periodDate,
    status: run.status,
    lineCount: run._count.lines,
  };
}

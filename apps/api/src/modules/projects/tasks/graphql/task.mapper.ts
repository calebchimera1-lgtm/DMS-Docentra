import type { ProjectTaskItemType } from "./task.type";

interface PrismaTaskWithRelations {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  estimatedMinutes: number | null;
  project: { id: string; name: string; code: string };
  assignee: { id: string; firstName: string; lastName: string } | null;
}

export function toProjectTaskItemType(task: PrismaTaskWithRelations): ProjectTaskItemType {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? undefined,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ?? undefined,
    estimatedMinutes: task.estimatedMinutes ?? undefined,
    project: task.project,
    assignee: task.assignee ?? undefined,
  };
}

import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects/projects.controller";
import { ProjectsResolver } from "./projects/projects.resolver";
import { ProjectsService } from "./projects/projects.service";
import { TasksController } from "./tasks/tasks.controller";
import { TasksResolver } from "./tasks/tasks.resolver";
import { TasksService } from "./tasks/tasks.service";
import { TimeEntriesController } from "./time-entries/time-entries.controller";
import { TimeEntriesResolver } from "./time-entries/time-entries.resolver";
import { TimeEntriesService } from "./time-entries/time-entries.service";
import { ProjectsReportsController } from "./reports/projects-reports.controller";
import { ProjectsReportsResolver } from "./reports/projects-reports.resolver";
import { ProjectsReportsService } from "./reports/projects-reports.service";

@Module({
  // Order matters: ProjectsController owns GET/PATCH/DELETE "projects/:id",
  // a wildcard that would otherwise shadow the literal "projects/tasks" and
  // "projects/time-entries" routes below it (Nest/Express match routes in
  // registration order) — so the literal-path controllers must come first.
  controllers: [
    TasksController,
    TimeEntriesController,
    ProjectsReportsController,
    ProjectsController,
  ],
  providers: [
    ProjectsService,
    ProjectsResolver,
    TasksService,
    TasksResolver,
    TimeEntriesService,
    TimeEntriesResolver,
    ProjectsReportsService,
    ProjectsReportsResolver,
  ],
})
export class ProjectsModule {}

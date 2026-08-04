import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Projects module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `projects-owner-${suffix}@test.com`;
  const viewerEmail = `projects-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let projectId: string;
  let taskId: string;
  let timeEntryId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const reg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Projects Co ${suffix}`,
        email: ownerEmail,
        password,
        firstName: "Owner",
        lastName: "Test",
      })
      .expect(201);
    ownerAccess = reg.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await app.close();
  });

  it("creates a project and rejects a duplicate code", async () => {
    const project = await request(app.getHttpServer())
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Website Redesign", code: "WEB", status: "ACTIVE", budgetCents: 5000000 })
      .expect(201);
    projectId = project.body.id;

    await request(app.getHttpServer())
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Duplicate", code: "WEB" })
      .expect(409);
  });

  it("does not let the projects/:id wildcard shadow projects/tasks or projects/time-entries", async () => {
    // Regression test for a routing collision: ProjectsController's
    // GET/PATCH/DELETE "projects/:id" must not intercept the literal
    // "projects/tasks" and "projects/time-entries" sub-resource routes.
    const tasks = await request(app.getHttpServer())
      .get("/api/v1/projects/tasks")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(tasks.body.items).toEqual([]);

    const timeEntries = await request(app.getHttpServer())
      .get("/api/v1/projects/time-entries")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(timeEntries.body.items).toEqual([]);

    const reportsSummary = await request(app.getHttpServer())
      .get("/api/v1/projects/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(reportsSummary.body.totalProjectCount).toBe(1);
  });

  it("creates a task under the project and rejects one referencing a foreign project", async () => {
    const task = await request(app.getHttpServer())
      .post("/api/v1/projects/tasks")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ projectId, title: "Design homepage", priority: "HIGH", dueDate: "2026-08-15" })
      .expect(201);
    taskId = task.body.id;
    expect(task.body.status).toBe("TODO");

    await request(app.getHttpServer())
      .post("/api/v1/projects/tasks")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ projectId: "00000000-0000-0000-0000-000000000000", title: "Ghost task" })
      .expect(400);
  });

  it("logs time against the task and rejects a task belonging to another company", async () => {
    const entry = await request(app.getHttpServer())
      .post("/api/v1/projects/time-entries")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ taskId, minutes: 120, entryDate: "2026-07-25", note: "Wireframes" })
      .expect(201);
    timeEntryId = entry.body.id;
    expect(entry.body.user.firstName).toBe("Owner");

    await request(app.getHttpServer())
      .post("/api/v1/projects/time-entries")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ taskId: "00000000-0000-0000-0000-000000000000", minutes: 30, entryDate: "2026-07-25" })
      .expect(400);
  });

  it("lets a user edit their own time entry but not one belonging to someone else", async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/projects/time-entries/${timeEntryId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ minutes: 90 })
      .expect(200);
    expect(updated.body.minutes).toBe(90);

    // Grant a role with projects:write up front so the other user can call
    // the endpoint at all — the 403 we're testing is the "not your own time
    // entry" guard, not RBAC.
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Projects Writer", description: "", permissionKeys: ["projects:read", "projects:write"] })
      .expect(201);

    const otherEmail = `projects-other-user-${suffix}@test.com`;
    const otherUser = await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ email: otherEmail, password, firstName: "Other", lastName: "User", roleIds: [role.body.id] })
      .expect(201);
    const otherLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: otherEmail, password })
      .expect(201);
    const otherAccess = otherLogin.body.accessToken;

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/time-entries/${timeEntryId}`)
      .set("Authorization", `Bearer ${otherAccess}`)
      .send({ minutes: 5 })
      .expect(403);

    await prisma.user.delete({ where: { id: otherUser.body.id } });
  });

  it("blocks deleting a task with logged time, and a project with tasks", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/projects/tasks/${taskId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);
  });

  it("moves a task through statuses and reports task counts by status", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/projects/tasks/${taskId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ status: "DONE" })
      .expect(200);

    const byStatus = await request(app.getHttpServer())
      .get("/api/v1/projects/reports/tasks-by-status")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const done = byStatus.body.find((s: { status: string }) => s.status === "DONE");
    expect(done.count).toBe(1);

    const summary = await request(app.getHttpServer())
      .get("/api/v1/projects/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(summary.body.openTaskCount).toBe(0);
    expect(summary.body.totalMinutesLogged).toBe(90);
  });

  it("exports projects, tasks, and time entries as CSV", async () => {
    const projectsCsv = await request(app.getHttpServer())
      .get("/api/v1/projects/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(projectsCsv.headers["content-type"]).toContain("text/csv");
    expect(projectsCsv.text).toContain("Website Redesign");

    const tasksCsv = await request(app.getHttpServer())
      .get("/api/v1/projects/tasks/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(tasksCsv.text).toContain("DONE");

    const timeEntriesCsv = await request(app.getHttpServer())
      .get("/api/v1/projects/time-entries/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(timeEntriesCsv.text).toContain("90");
  });

  it("exposes the same data over GraphQL as REST", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        query: `query { projectsSummary { totalProjectCount totalMinutesLogged } projects(page: 1, pageSize: 10) { total items { code status } } projectTasks(page: 1, pageSize: 10) { total items { title status project { code } } } timeEntries(page: 1, pageSize: 10) { total items { minutes task { title } } } }`,
      })
      .expect(200);
    expect(res.body.data.projectsSummary.totalProjectCount).toBe(1);
    expect(res.body.data.projects.items[0].code).toBe("WEB");
    expect(res.body.data.projectTasks.total).toBe(1);
    expect(res.body.data.timeEntries.items[0].minutes).toBe(90);
  });

  it("enforces RBAC: a role without projects permissions is forbidden", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "No Projects", description: "Everything except projects", permissionKeys: ["users:read"] })
      .expect(201);

    const user = await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ email: viewerEmail, password, firstName: "Val", lastName: "Viewer", roleIds: [role.body.id] })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: viewerEmail, password })
      .expect(201);
    const viewerAccess = login.body.accessToken;

    await request(app.getHttpServer())
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/projects/tasks")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .send({ projectId, title: "Nope" })
      .expect(403);

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enforces tenant isolation: another company cannot see these project records", async () => {
    const otherEmail = `projects-other-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Other Projects Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/v1/projects/tasks")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(200);
    expect(list.body.total).toBe(0);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});

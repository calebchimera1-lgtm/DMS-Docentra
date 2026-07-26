import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Recruitment module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `recruitment-owner-${suffix}@test.com`;
  const viewerEmail = `recruitment-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let postingId: string;
  let candidateId: string;
  let applicationId: string;

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
        companyName: `Recruitment Co ${suffix}`,
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

  it("creates a job posting and a candidate", async () => {
    const posting = await request(app.getHttpServer())
      .post("/api/v1/recruitment/job-postings")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ title: "Senior Backend Engineer", employmentType: "FULL_TIME", openings: 2 })
      .expect(201);
    postingId = posting.body.id;
    expect(posting.body.status).toBe("OPEN");

    const candidate = await request(app.getHttpServer())
      .post("/api/v1/recruitment/candidates")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ firstName: "Jamie", lastName: "Applicant", email: "jamie.applicant@test.com", source: "LinkedIn" })
      .expect(201);
    candidateId = candidate.body.id;
  });

  it("creates an application and rejects a duplicate for the same posting", async () => {
    const application = await request(app.getHttpServer())
      .post("/api/v1/recruitment/applications")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ jobPostingId: postingId, candidateId, notes: "Strong resume" })
      .expect(201);
    applicationId = application.body.id;
    expect(application.body.status).toBe("APPLIED");

    await request(app.getHttpServer())
      .post("/api/v1/recruitment/applications")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ jobPostingId: postingId, candidateId })
      .expect(409);
  });

  it("rejects out-of-order pipeline transitions", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/recruitment/applications/${applicationId}/offer`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/recruitment/applications/${applicationId}/hire`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ hireDate: "2026-08-15" })
      .expect(400);
  });

  it("moves an application through screen -> interview -> offer", async () => {
    const screened = await request(app.getHttpServer())
      .post(`/api/v1/recruitment/applications/${applicationId}/screen`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(screened.body.status).toBe("SCREENING");

    const interviewing = await request(app.getHttpServer())
      .post(`/api/v1/recruitment/applications/${applicationId}/interview`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(interviewing.body.status).toBe("INTERVIEWING");

    const offered = await request(app.getHttpServer())
      .post(`/api/v1/recruitment/applications/${applicationId}/offer`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(offered.body.status).toBe("OFFERED");
  });

  it("schedules, edits, and completes an interview", async () => {
    const interview = await request(app.getHttpServer())
      .post("/api/v1/recruitment/interviews")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ applicationId, stage: "Technical", scheduledAt: "2026-08-01T15:00:00Z" })
      .expect(201);
    expect(interview.body.status).toBe("SCHEDULED");

    const rescheduled = await request(app.getHttpServer())
      .patch(`/api/v1/recruitment/interviews/${interview.body.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ scheduledAt: "2026-08-02T15:00:00Z" })
      .expect(200);
    expect(new Date(rescheduled.body.scheduledAt).toISOString()).toBe("2026-08-02T15:00:00.000Z");

    const completed = await request(app.getHttpServer())
      .post(`/api/v1/recruitment/interviews/${interview.body.id}/complete`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ feedback: "Strong technical skills", rating: 5 })
      .expect(201);
    expect(completed.body.status).toBe("COMPLETED");
    expect(completed.body.rating).toBe(5);

    await request(app.getHttpServer())
      .post(`/api/v1/recruitment/interviews/${interview.body.id}/complete`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({})
      .expect(400);
  });

  it("hires an OFFERED application, creating a real HR Employee", async () => {
    const hired = await request(app.getHttpServer())
      .post(`/api/v1/recruitment/applications/${applicationId}/hire`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ hireDate: "2026-08-15", salaryCents: 12000000, currency: "USD" })
      .expect(201);
    expect(hired.body.status).toBe("HIRED");
    expect(hired.body.hiredEmployeeId).toBeTruthy();

    const employee = await request(app.getHttpServer())
      .get(`/api/v1/hr/employees/${hired.body.hiredEmployeeId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(employee.body.firstName).toBe("Jamie");
    expect(employee.body.lastName).toBe("Applicant");
    expect(employee.body.email).toBe("jamie.applicant@test.com");
    expect(employee.body.jobTitle).toBe("Senior Backend Engineer");
    expect(employee.body.salaryCents).toBe(12000000);
    expect(employee.body.employeeNumber).toMatch(/^EMP-/);

    await request(app.getHttpServer())
      .post(`/api/v1/recruitment/applications/${applicationId}/hire`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ hireDate: "2026-08-15" })
      .expect(400);
  });

  it("rejects a different application with a reason, and allows withdrawing a draft one", async () => {
    const candidate2 = await request(app.getHttpServer())
      .post("/api/v1/recruitment/candidates")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ firstName: "Alex", lastName: "Second", email: "alex.second@test.com" })
      .expect(201);
    const app2 = await request(app.getHttpServer())
      .post("/api/v1/recruitment/applications")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ jobPostingId: postingId, candidateId: candidate2.body.id })
      .expect(201);

    const rejected = await request(app.getHttpServer())
      .post(`/api/v1/recruitment/applications/${app2.body.id}/reject`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ rejectionReason: "Not enough experience" })
      .expect(201);
    expect(rejected.body.status).toBe("REJECTED");

    await request(app.getHttpServer())
      .post(`/api/v1/recruitment/applications/${app2.body.id}/withdraw`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);

    const candidate3 = await request(app.getHttpServer())
      .post("/api/v1/recruitment/candidates")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ firstName: "Jo", lastName: "Third", email: "jo.third@test.com" })
      .expect(201);
    const app3 = await request(app.getHttpServer())
      .post("/api/v1/recruitment/applications")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ jobPostingId: postingId, candidateId: candidate3.body.id })
      .expect(201);
    const withdrawn = await request(app.getHttpServer())
      .post(`/api/v1/recruitment/applications/${app3.body.id}/withdraw`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(withdrawn.body.status).toBe("WITHDRAWN");
  });

  it("closes and reopens a job posting", async () => {
    const closed = await request(app.getHttpServer())
      .post(`/api/v1/recruitment/job-postings/${postingId}/close`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(closed.body.status).toBe("CLOSED");

    await request(app.getHttpServer())
      .post(`/api/v1/recruitment/job-postings/${postingId}/close`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);

    const reopened = await request(app.getHttpServer())
      .post(`/api/v1/recruitment/job-postings/${postingId}/reopen`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(reopened.body.status).toBe("OPEN");
  });

  it("reports pipeline counts and applications by status", async () => {
    const summary = await request(app.getHttpServer())
      .get("/api/v1/recruitment/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(summary.body.hiredCount).toBe(1);

    const byStatus = await request(app.getHttpServer())
      .get("/api/v1/recruitment/reports/applications-by-status")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const hired = byStatus.body.find((s: { status: string }) => s.status === "HIRED");
    expect(hired.count).toBe(1);
  });

  it("exports job postings, candidates, applications, and interviews as CSV", async () => {
    const postingsCsv = await request(app.getHttpServer())
      .get("/api/v1/recruitment/job-postings/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(postingsCsv.headers["content-type"]).toContain("text/csv");
    expect(postingsCsv.text).toContain("Senior Backend Engineer");

    const candidatesCsv = await request(app.getHttpServer())
      .get("/api/v1/recruitment/candidates/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(candidatesCsv.text).toContain("Jamie");

    const applicationsCsv = await request(app.getHttpServer())
      .get("/api/v1/recruitment/applications/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(applicationsCsv.text).toContain("HIRED");

    const interviewsCsv = await request(app.getHttpServer())
      .get("/api/v1/recruitment/interviews/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(interviewsCsv.text).toContain("COMPLETED");
  });

  it("exposes the same data over GraphQL as REST", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        query: `query { recruitmentSummary { hiredCount } jobPostings(page: 1, pageSize: 10) { total } candidates(page: 1, pageSize: 10) { total } applications(page: 1, pageSize: 10) { total items { status } } interviews(page: 1, pageSize: 10) { total items { status rating } } }`,
      })
      .expect(200);
    expect(res.body.data.recruitmentSummary.hiredCount).toBe(1);
    expect(res.body.data.jobPostings.total).toBe(1);
    expect(res.body.data.candidates.total).toBeGreaterThanOrEqual(3);
    expect(res.body.data.applications.total).toBeGreaterThanOrEqual(3);
    expect(res.body.data.interviews.total).toBeGreaterThanOrEqual(1);
  });

  it("enforces RBAC: a role without recruitment permissions is forbidden", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "No Recruitment", description: "Everything except recruitment", permissionKeys: ["users:read"] })
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
      .get("/api/v1/recruitment/applications")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/recruitment/candidates")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .send({ firstName: "Nope", lastName: "Nope", email: "nope@test.com" })
      .expect(403);

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enforces tenant isolation: another company cannot see these recruitment records", async () => {
    const otherEmail = `recruitment-isolation-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Other Recruitment Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/recruitment/applications/${applicationId}`)
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/v1/recruitment/job-postings")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(200);
    expect(list.body.total).toBe(0);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});

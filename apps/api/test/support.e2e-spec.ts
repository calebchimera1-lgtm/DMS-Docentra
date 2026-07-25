import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Support module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `support-owner-${suffix}@test.com`;
  const viewerEmail = `support-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let ownerId: string;
  let ticketId: string;

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
        companyName: `Support Co ${suffix}`,
        email: ownerEmail,
        password,
        firstName: "Owner",
        lastName: "Test",
      })
      .expect(201);
    ownerAccess = reg.body.accessToken;
    ownerId = JSON.parse(Buffer.from(ownerAccess.split(".")[1], "base64").toString()).sub;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await app.close();
  });

  it("creates a ticket (OPEN, auto-numbered) and rejects an account/contact from another company", async () => {
    const ticket = await request(app.getHttpServer())
      .post("/api/v1/support/tickets")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ subject: "Cannot log in", description: "500 error", priority: "HIGH", requesterEmail: "customer@example.com" })
      .expect(201);
    ticketId = ticket.body.id;
    expect(ticket.body.ticketNumber).toMatch(/^TKT-\d{6}$/);
    expect(ticket.body.status).toBe("OPEN");

    await request(app.getHttpServer())
      .post("/api/v1/support/tickets")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ subject: "Ghost", accountId: "00000000-0000-0000-0000-000000000000" })
      .expect(400);
  });

  it("creating a ticket already assigned starts it IN_PROGRESS", async () => {
    const ticket = await request(app.getHttpServer())
      .post("/api/v1/support/tickets")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ subject: "Pre-assigned ticket", assigneeId: ownerId })
      .expect(201);
    expect(ticket.body.status).toBe("IN_PROGRESS");
    expect(ticket.body.assignee.id).toBe(ownerId);
  });

  it("assigns an OPEN ticket, which moves it to IN_PROGRESS", async () => {
    const assigned = await request(app.getHttpServer())
      .post(`/api/v1/support/tickets/${ticketId}/assign`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ assigneeId: ownerId })
      .expect(201);
    expect(assigned.body.status).toBe("IN_PROGRESS");
    expect(assigned.body.assignee.id).toBe(ownerId);
  });

  it("walks a ticket through resolve -> (reject double-resolve) -> close -> reopen -> (reject double-reopen)", async () => {
    const resolved = await request(app.getHttpServer())
      .post(`/api/v1/support/tickets/${ticketId}/resolve`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(resolved.body.status).toBe("RESOLVED");
    expect(resolved.body.resolvedAt).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/api/v1/support/tickets/${ticketId}/resolve`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);

    const closed = await request(app.getHttpServer())
      .post(`/api/v1/support/tickets/${ticketId}/close`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(closed.body.status).toBe("CLOSED");
    expect(closed.body.closedAt).toBeTruthy();

    const reopened = await request(app.getHttpServer())
      .post(`/api/v1/support/tickets/${ticketId}/reopen`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(reopened.body.status).toBe("OPEN");
    expect(reopened.body.resolvedAt).toBeNull();
    expect(reopened.body.closedAt).toBeNull();

    await request(app.getHttpServer())
      .post(`/api/v1/support/tickets/${ticketId}/reopen`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("reuses the generic Comments module for ticket replies (entityType=Ticket)", async () => {
    const comment = await request(app.getHttpServer())
      .post("/api/v1/comments")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ entityType: "Ticket", entityId: ticketId, body: "Looking into it" })
      .expect(201);
    expect(comment.body.body).toBe("Looking into it");

    const list = await request(app.getHttpServer())
      .get(`/api/v1/comments?entityType=Ticket&entityId=${ticketId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it("reports open/unassigned/overdue/total counts and tickets-by-status", async () => {
    const summary = await request(app.getHttpServer())
      .get("/api/v1/support/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(summary.body.totalTicketCount).toBe(2);
    expect(summary.body.openTicketCount).toBe(2); // ticketId is back OPEN, the other is IN_PROGRESS

    const byStatus = await request(app.getHttpServer())
      .get("/api/v1/support/reports/tickets-by-status")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const open = byStatus.body.find((s: { status: string }) => s.status === "OPEN");
    expect(open.count).toBe(1);
  });

  it("exports tickets as CSV", async () => {
    const csv = await request(app.getHttpServer())
      .get("/api/v1/support/tickets/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text).toContain("Cannot log in");
  });

  it("exposes the same data over GraphQL as REST", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        query: `query { supportSummary { totalTicketCount } tickets(page: 1, pageSize: 10) { total items { ticketNumber status assignee { firstName } } } }`,
      })
      .expect(200);
    expect(res.body.data.supportSummary.totalTicketCount).toBe(2);
    expect(res.body.data.tickets.total).toBe(2);
  });

  it("deletes a ticket", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/support/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/support/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(404);
  });

  it("enforces RBAC: a role without support permissions is forbidden", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "No Support", description: "Everything except support", permissionKeys: ["users:read"] })
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
      .get("/api/v1/support/tickets")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/support/tickets")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .send({ subject: "Nope" })
      .expect(403);

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enforces tenant isolation: another company cannot see these tickets", async () => {
    const otherEmail = `support-other-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Other Support Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get("/api/v1/support/tickets")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(200);
    expect(list.body.total).toBe(0);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});

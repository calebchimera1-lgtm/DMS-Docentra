import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Notifications triggered by business events (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `notif-owner-${suffix}@test.com`;
  const staffEmail = `notif-staff-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let ownerUserId: string;
  let staffAccess: string;
  let staffUserId: string;
  let accountId: string;
  let warehouseId: string;
  let productId: string;

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
        companyName: `Notif Co ${suffix}`,
        email: ownerEmail,
        password,
        firstName: "Owner",
        lastName: "Test",
      })
      .expect(201);
    ownerAccess = reg.body.accessToken;
    ownerUserId = JSON.parse(Buffer.from(ownerAccess.split(".")[1], "base64").toString()).sub;

    const staff = await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ email: staffEmail, password, firstName: "Staff", lastName: "Member" })
      .expect(201);
    staffUserId = staff.body.id;

    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: staffEmail, password })
      .expect(201);
    staffAccess = login.body.accessToken;

    const account = await request(app.getHttpServer())
      .post("/api/v1/crm/accounts")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Notif Test Account" })
      .expect(201);
    accountId = account.body.id;

    const warehouse = await request(app.getHttpServer())
      .post("/api/v1/inventory/warehouses")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Notif Warehouse", code: "NOTIFWH" })
      .expect(201);
    warehouseId = warehouse.body.id;

    const product = await request(app.getHttpServer())
      .post("/api/v1/sales/products")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ sku: "NOTIFY-SKU", name: "Notify Widget", unitPriceCents: 1000 })
      .expect(201);
    productId = product.body.id;

    await request(app.getHttpServer())
      .post("/api/v1/inventory/movements")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ productId, warehouseId, type: "RECEIPT", quantity: 50, note: "Opening stock" })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, staffEmail] } } });
    await app.close();
  });

  it("notifies the order owner when their sales order is fulfilled", async () => {
    const order = await request(app.getHttpServer())
      .post("/api/v1/sales/orders")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        accountId,
        ownerId: staffUserId,
        items: [{ productId, description: "Notify widget x5", quantity: 5, unitPriceCents: 1000 }],
      })
      .expect(201);
    expect(order.body.ownerId).toBe(staffUserId);

    await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${order.body.id}/fulfill`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ warehouseId })
      .expect(201);

    const notifications = await request(app.getHttpServer())
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${staffAccess}`)
      .expect(200);
    const fulfilled = notifications.body.items.find((n: { title: string }) => n.title === "Sales order fulfilled");
    expect(fulfilled).toBeDefined();
    expect(fulfilled.body).toContain(order.body.orderNumber);

    // The order owner inherited onto the invoice, and paying it notifies the same owner.
    const invoice = await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${order.body.id}/convert-to-invoice`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(invoice.body.ownerId).toBe(staffUserId);

    await request(app.getHttpServer())
      .post(`/api/v1/sales/invoices/${invoice.body.id}/mark-paid`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);

    const afterPaid = await request(app.getHttpServer())
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${staffAccess}`)
      .expect(200);
    const paid = afterPaid.body.items.find((n: { title: string }) => n.title === "Invoice paid");
    expect(paid).toBeDefined();
    expect(paid.body).toContain(invoice.body.invoiceNumber);
  });

  it("notifies the requesting employee's linked user when their leave request is approved or rejected", async () => {
    const approverEmployee = await request(app.getHttpServer())
      .post("/api/v1/hr/employees")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ firstName: "Owner", lastName: "Approver", hireDate: "2022-01-01", userId: ownerUserId })
      .expect(201);

    const requesterEmployee = await request(app.getHttpServer())
      .post("/api/v1/hr/employees")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ firstName: "Staff", lastName: "Requester", hireDate: "2023-01-01", userId: staffUserId })
      .expect(201);
    expect(approverEmployee.body.id).not.toBe(requesterEmployee.body.id);

    const approvedRequest = await request(app.getHttpServer())
      .post("/api/v1/hr/leave-requests")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        employeeId: requesterEmployee.body.id,
        type: "VACATION",
        startDate: "2026-09-01",
        endDate: "2026-09-03",
        reason: "Notification test",
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/hr/leave-requests/${approvedRequest.body.id}/approve`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);

    const rejectedRequest = await request(app.getHttpServer())
      .post("/api/v1/hr/leave-requests")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        employeeId: requesterEmployee.body.id,
        type: "SICK",
        startDate: "2026-10-01",
        endDate: "2026-10-02",
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/hr/leave-requests/${rejectedRequest.body.id}/reject`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);

    const notifications = await request(app.getHttpServer())
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${staffAccess}`)
      .expect(200);
    const titles = notifications.body.items.map((n: { title: string }) => n.title);
    expect(titles).toEqual(expect.arrayContaining(["Leave request approved", "Leave request rejected"]));
  });

  it("tracks unread count and marks notifications read", async () => {
    const before = await request(app.getHttpServer())
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${staffAccess}`)
      .expect(200);
    expect(before.body.count).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .post("/api/v1/notifications/read-all")
      .set("Authorization", `Bearer ${staffAccess}`)
      .expect(204);

    const after = await request(app.getHttpServer())
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${staffAccess}`)
      .expect(200);
    expect(after.body.count).toBe(0);
  });
});

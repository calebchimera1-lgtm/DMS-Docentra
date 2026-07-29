import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Documents module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `docs-owner-${suffix}@test.com`;
  const editorEmail = `docs-editor-${suffix}@test.com`;
  const viewerEmail = `docs-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  /** A second user with documents:write, used to prove the lock is exclusive. */
  let editorAccess: string;
  let editorUserId: string;

  let rootFolderId: string;
  let childFolderId: string;
  let grandchildFolderId: string;
  let documentId: string;

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
        companyName: `Docs Co ${suffix}`,
        email: ownerEmail,
        password,
        firstName: "Olive",
        lastName: "Owner",
      })
      .expect(201);
    ownerAccess = reg.body.accessToken;

    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Doc Editor", description: "docs", permissionKeys: ["documents:read", "documents:write"] })
      .expect(201);

    const editor = await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ email: editorEmail, password, firstName: "Eddie", lastName: "Editor", roleIds: [role.body.id] })
      .expect(201);
    editorUserId = editor.body.id;

    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: editorEmail, password })
      .expect(201);
    editorAccess = login.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, editorEmail, viewerEmail] } } });
    await app.close();
  });

  it("builds a folder tree", async () => {
    const root = await request(app.getHttpServer())
      .post("/api/v1/documents/folders")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Policies", description: "Company policies" })
      .expect(201);
    rootFolderId = root.body.id;
    expect(root.body.parent).toBeNull();

    const child = await request(app.getHttpServer())
      .post("/api/v1/documents/folders")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "HR", parentId: rootFolderId })
      .expect(201);
    childFolderId = child.body.id;
    expect(child.body.parent.name).toBe("Policies");

    const grandchild = await request(app.getHttpServer())
      .post("/api/v1/documents/folders")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Onboarding", parentId: childFolderId })
      .expect(201);
    grandchildFolderId = grandchild.body.id;
  });

  it("refuses to make a folder its own parent", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/documents/folders/${rootFolderId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ parentId: rootFolderId })
      .expect(400);
  });

  it("refuses to move a folder inside its own descendant", async () => {
    // Policies -> HR -> Onboarding. Moving Policies under Onboarding would
    // detach the whole branch from the root.
    await request(app.getHttpServer())
      .patch(`/api/v1/documents/folders/${rootFolderId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ parentId: grandchildFolderId })
      .expect(400);
  });

  it("allows a legitimate move that does not create a cycle", async () => {
    const moved = await request(app.getHttpServer())
      .patch(`/api/v1/documents/folders/${grandchildFolderId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ parentId: rootFolderId })
      .expect(200);
    expect(moved.body.parent.id).toBe(rootFolderId);
  });

  it("refuses to delete a folder that still has children", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/documents/folders/${rootFolderId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);
  });

  it("creates a document together with version 1", async () => {
    const doc = await request(app.getHttpServer())
      .post("/api/v1/documents/files")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        title: "Employee Handbook",
        folderId: childFolderId,
        description: "The staff handbook",
        fileName: "handbook-v1.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10_240,
      })
      .expect(201);
    documentId = doc.body.id;

    expect(doc.body.status).toBe("DRAFT");
    expect(doc.body.currentVersionNumber).toBe(1);
    expect(doc.body.versions).toHaveLength(1);
    expect(doc.body.versions[0].versionNumber).toBe(1);
    expect(doc.body.versions[0].note).toBe("Initial version");
    expect(doc.body.checkedOutById).toBeNull();
  });

  it("rejects a folder from another company", async () => {
    const otherEmail = `docs-foreign-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Foreign Docs Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Fern",
        lastName: "Foreign",
      })
      .expect(201);

    const foreignFolder = await request(app.getHttpServer())
      .post("/api/v1/documents/folders")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .send({ name: "Foreign" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/documents/files")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ title: "Nope", folderId: foreignFolder.body.id, fileName: "x.pdf" })
      .expect(400);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });

  it("refuses to check in a document that is not checked out", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/documents/files/${documentId}/check-in`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ fileName: "handbook-v2.pdf" })
      .expect(400);
  });

  it("takes the exclusive lock and blocks every other user from editing it", async () => {
    const checkedOut = await request(app.getHttpServer())
      .post(`/api/v1/documents/files/${documentId}/check-out`)
      .set("Authorization", `Bearer ${editorAccess}`)
      .expect(201);
    expect(checkedOut.body.checkedOutById).toBe(editorUserId);
    expect(checkedOut.body.checkedOutAt).toBeTruthy();

    // The owner is a different user: every editing path must conflict, and
    // 409 (not 400) because the request would succeed once the lock clears.
    for (const path of ["check-out", "cancel-check-out"]) {
      await request(app.getHttpServer())
        .post(`/api/v1/documents/files/${documentId}/${path}`)
        .set("Authorization", `Bearer ${ownerAccess}`)
        .expect(409);
    }

    await request(app.getHttpServer())
      .post(`/api/v1/documents/files/${documentId}/check-in`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ fileName: "hijack.pdf" })
      .expect(409);

    const conflict = await request(app.getHttpServer())
      .patch(`/api/v1/documents/files/${documentId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ title: "Hijacked" })
      .expect(409);
    expect(conflict.body.message).toContain("Eddie Editor");

    // Status changes are refused too, but as a plain bad request: the
    // document must be checked in first regardless of who asks.
    await request(app.getHttpServer())
      .post(`/api/v1/documents/files/${documentId}/publish`)
      .set("Authorization", `Bearer ${editorAccess}`)
      .expect(400);
  });

  it("rejects the lock holder checking the same document out twice", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/documents/files/${documentId}/check-out`)
      .set("Authorization", `Bearer ${editorAccess}`)
      .expect(400);
  });

  it("appends the next version and releases the lock on check-in", async () => {
    const checkedIn = await request(app.getHttpServer())
      .post(`/api/v1/documents/files/${documentId}/check-in`)
      .set("Authorization", `Bearer ${editorAccess}`)
      .send({ fileName: "handbook-v2.pdf", note: "Added remote-work section", sizeBytes: 11_500 })
      .expect(201);

    expect(checkedIn.body.currentVersionNumber).toBe(2);
    expect(checkedIn.body.checkedOutById).toBeNull();
    expect(checkedIn.body.checkedOutAt).toBeNull();
    expect(checkedIn.body.versions).toHaveLength(2);
    // Newest first.
    expect(checkedIn.body.versions.map((v: { versionNumber: number }) => v.versionNumber)).toEqual([2, 1]);
    expect(checkedIn.body.versions[0].note).toBe("Added remote-work section");
    expect(checkedIn.body.versions[0].createdBy.id).toBe(editorUserId);
  });

  it("releases the lock without a new version when a check-out is cancelled", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/documents/files/${documentId}/check-out`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/documents/files/${documentId}/cancel-check-out`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);

    expect(cancelled.body.checkedOutById).toBeNull();
    // Still v2 — cancelling adds nothing.
    expect(cancelled.body.currentVersionNumber).toBe(2);
    expect(cancelled.body.versions).toHaveLength(2);
  });

  it("publishes, archives, and restores a document", async () => {
    const published = await request(app.getHttpServer())
      .post(`/api/v1/documents/files/${documentId}/publish`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(published.body.status).toBe("PUBLISHED");

    // Publishing twice is rejected.
    await request(app.getHttpServer())
      .post(`/api/v1/documents/files/${documentId}/publish`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);

    // A published document cannot be deleted until it is archived.
    await request(app.getHttpServer())
      .delete(`/api/v1/documents/files/${documentId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);

    const archived = await request(app.getHttpServer())
      .post(`/api/v1/documents/files/${documentId}/archive`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(archived.body.status).toBe("ARCHIVED");

    // An archived document cannot be checked out.
    await request(app.getHttpServer())
      .post(`/api/v1/documents/files/${documentId}/check-out`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);

    const restored = await request(app.getHttpServer())
      .post(`/api/v1/documents/files/${documentId}/restore`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(restored.body.status).toBe("PUBLISHED");
  });

  it("edits document metadata and filters the list", async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/documents/files/${documentId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ description: "Revised staff handbook" })
      .expect(200);
    expect(updated.body.description).toBe("Revised staff handbook");

    const bySearch = await request(app.getHttpServer())
      .get("/api/v1/documents/files?search=Handbook")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(bySearch.body.total).toBe(1);

    const byFolder = await request(app.getHttpServer())
      .get(`/api/v1/documents/files?folderId=${childFolderId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(byFolder.body.total).toBe(1);

    const checkedOutOnly = await request(app.getHttpServer())
      .get("/api/v1/documents/files?checkedOutOnly=true")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(checkedOutOnly.body.total).toBe(0);
  });

  it("lists only root folders when asked", async () => {
    const roots = await request(app.getHttpServer())
      .get("/api/v1/documents/folders?rootOnly=true")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(roots.body.items.every((f: { parent: unknown }) => f.parent === null)).toBe(true);
    expect(roots.body.total).toBe(1);
  });

  it("deletes an empty folder but not a document that is checked out", async () => {
    const spare = await request(app.getHttpServer())
      .post("/api/v1/documents/folders")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: `Spare ${suffix}` })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/documents/folders/${spare.body.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(204);

    const draft = await request(app.getHttpServer())
      .post("/api/v1/documents/files")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ title: "Scratch", fileName: "scratch.txt" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/documents/files/${draft.body.id}/check-out`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/documents/files/${draft.body.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/documents/files/${draft.body.id}/cancel-check-out`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/documents/files/${draft.body.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(204);
  });

  it("reports the documents summary and by-status breakdown", async () => {
    const summary = await request(app.getHttpServer())
      .get("/api/v1/documents/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(summary.body.publishedCount).toBe(1);
    expect(summary.body.checkedOutCount).toBe(0);
    expect(summary.body.folderCount).toBe(3);
    // Two versions on the handbook; the deleted scratch document's version
    // is excluded because the count is scoped through its parent.
    expect(summary.body.versionCount).toBe(2);

    const byStatus = await request(app.getHttpServer())
      .get("/api/v1/documents/reports/by-status")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(byStatus.body).toHaveLength(3);
  });

  it("exports documents and folders as CSV", async () => {
    const docs = await request(app.getHttpServer())
      .get("/api/v1/documents/files/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(docs.headers["content-type"]).toContain("text/csv");
    expect(docs.text).toContain("Employee Handbook");

    const folders = await request(app.getHttpServer())
      .get("/api/v1/documents/folders/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(folders.text).toContain("Policies");
  });

  it("exposes the same data over GraphQL as REST", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        query: `query {
          documentsSummary { publishedCount checkedOutCount folderCount versionCount }
          documentsByStatus { status count }
          documentFolders(page:1,pageSize:20) { total items { name subfolderCount documentCount } }
          documents(page:1,pageSize:20) { total items { title status currentVersionNumber } }
          document(id:"${documentId}") { title currentVersionNumber versions { versionNumber fileName note } }
        }`,
      })
      .expect(200);

    expect(res.body.data.documentsSummary.publishedCount).toBe(1);
    expect(res.body.data.documentsSummary.versionCount).toBe(2);
    expect(res.body.data.documentsByStatus).toHaveLength(3);
    expect(res.body.data.documentFolders.total).toBe(3);
    expect(res.body.data.documents.total).toBe(1);
    expect(res.body.data.document.currentVersionNumber).toBe(2);
    expect(res.body.data.document.versions).toHaveLength(2);
  });

  it("enforces RBAC: a role without documents permissions is forbidden", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "No Documents", description: "Everything except documents", permissionKeys: ["users:read"] })
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
      .get("/api/v1/documents/files")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .get("/api/v1/documents/folders")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/documents/files/${documentId}/check-out`)
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .get("/api/v1/documents/reports/summary")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enforces tenant isolation: another company cannot see these documents", async () => {
    const otherEmail = `docs-isolation-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Other Docs Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);
    const otherAccess = otherReg.body.accessToken;

    await request(app.getHttpServer())
      .get(`/api/v1/documents/files/${documentId}`)
      .set("Authorization", `Bearer ${otherAccess}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/documents/folders/${rootFolderId}`)
      .set("Authorization", `Bearer ${otherAccess}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/v1/documents/files")
      .set("Authorization", `Bearer ${otherAccess}`)
      .expect(200);
    expect(list.body.total).toBe(0);

    const summary = await request(app.getHttpServer())
      .get("/api/v1/documents/reports/summary")
      .set("Authorization", `Bearer ${otherAccess}`)
      .expect(200);
    expect(summary.body.versionCount).toBe(0);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});

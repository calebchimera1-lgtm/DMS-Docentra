import request from 'supertest';
import { app, authHeader, registerOrgAndLogin } from './helpers';

describe('Documents module', () => {
  it('uploads a document, retrieves it, and downloads the exact bytes back', async () => {
    const { accessToken } = await registerOrgAndLogin('Docs Upload Co');

    const uploadRes = await request(app)
      .post('/api/v1/documents/upload')
      .set(authHeader(accessToken))
      .attach('file', Buffer.from('Hello Docentra!'), { filename: 'hello.txt', contentType: 'text/plain' });

    expect(uploadRes.status).toBe(201);
    const documentId = uploadRes.body.data.id;
    expect(documentId).toBeTruthy();

    const getRes = await request(app).get(`/api/v1/documents/${documentId}`).set(authHeader(accessToken));
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.name).toBe('hello.txt');

    const downloadRes = await request(app).get(`/api/v1/documents/${documentId}/download`).set(authHeader(accessToken));
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.text).toBe('Hello Docentra!');
  });

  it('detects duplicate uploads via checksum', async () => {
    const { accessToken } = await registerOrgAndLogin('Duplicate Co');
    const content = Buffer.from('Duplicate content check');

    const first = await request(app)
      .post('/api/v1/documents/upload')
      .set(authHeader(accessToken))
      .attach('file', content, { filename: 'a.txt', contentType: 'text/plain' });

    const second = await request(app)
      .post('/api/v1/documents/upload')
      .set(authHeader(accessToken))
      .attach('file', content, { filename: 'b.txt', contentType: 'text/plain' });

    expect(second.body.data.isDuplicateOf).toBe(first.body.data.id);
  });

  it('supports folder creation and moving a document into it', async () => {
    const { accessToken } = await registerOrgAndLogin('Folder Move Co');

    const folderRes = await request(app).post('/api/v1/folders').set(authHeader(accessToken)).send({ name: 'Invoices' });
    expect(folderRes.status).toBe(201);
    const folderId = folderRes.body.data.id;

    const uploadRes = await request(app)
      .post('/api/v1/documents/upload')
      .set(authHeader(accessToken))
      .attach('file', Buffer.from('invoice content'), { filename: 'invoice.txt', contentType: 'text/plain' });
    const documentId = uploadRes.body.data.id;

    const moveRes = await request(app)
      .patch(`/api/v1/documents/${documentId}/move`)
      .set(authHeader(accessToken))
      .send({ folderId });
    expect(moveRes.status).toBe(200);
    expect(moveRes.body.data.folderId).toBe(folderId);
  });

  it('creates a new version and preserves version history', async () => {
    const { accessToken } = await registerOrgAndLogin('Versioning Co');

    const uploadRes = await request(app)
      .post('/api/v1/documents/upload')
      .set(authHeader(accessToken))
      .attach('file', Buffer.from('version 1'), { filename: 'doc.txt', contentType: 'text/plain' });
    const documentId = uploadRes.body.data.id;

    const versionRes = await request(app)
      .post(`/api/v1/documents/${documentId}/versions`)
      .set(authHeader(accessToken))
      .field('comment', 'Updated content')
      .attach('file', Buffer.from('version 2'), { filename: 'doc.txt', contentType: 'text/plain' });

    expect(versionRes.status).toBe(201);
    expect(versionRes.body.data.currentVersion).toBe(2);

    const listRes = await request(app).get(`/api/v1/documents/${documentId}/versions`).set(authHeader(accessToken));
    expect(listRes.body.data).toHaveLength(2);

    const downloadRes = await request(app).get(`/api/v1/documents/${documentId}/download`).set(authHeader(accessToken));
    expect(downloadRes.text).toBe('version 2');
  });

  it('enforces check-out locking so other users cannot upload new versions', async () => {
    const { accessToken } = await registerOrgAndLogin('Locking Co');

    const uploadRes = await request(app)
      .post('/api/v1/documents/upload')
      .set(authHeader(accessToken))
      .attach('file', Buffer.from('locked content'), { filename: 'locked.txt', contentType: 'text/plain' });
    const documentId = uploadRes.body.data.id;

    const checkoutRes = await request(app).post(`/api/v1/documents/${documentId}/check-out`).set(authHeader(accessToken));
    expect(checkoutRes.status).toBe(200);
    expect(checkoutRes.body.data.isLocked).toBe(true);

    const secondCheckout = await request(app).post(`/api/v1/documents/${documentId}/check-out`).set(authHeader(accessToken));
    expect(secondCheckout.status).toBe(409);

    const checkinRes = await request(app).post(`/api/v1/documents/${documentId}/check-in`).set(authHeader(accessToken));
    expect(checkinRes.status).toBe(200);
    expect(checkinRes.body.data.isLocked).toBe(false);
  });

  it('moves a document to the recycle bin, restores it, and permanently deletes it', async () => {
    const { accessToken } = await registerOrgAndLogin('Recycle Bin Co');

    const uploadRes = await request(app)
      .post('/api/v1/documents/upload')
      .set(authHeader(accessToken))
      .attach('file', Buffer.from('to be deleted'), { filename: 'delete-me.txt', contentType: 'text/plain' });
    const documentId = uploadRes.body.data.id;

    const deleteRes = await request(app).delete(`/api/v1/documents/${documentId}`).set(authHeader(accessToken));
    expect(deleteRes.status).toBe(200);

    const recycleBinRes = await request(app).get('/api/v1/documents/recycle-bin').set(authHeader(accessToken));
    expect(recycleBinRes.body.data.documents.some((d: { id: string }) => d.id === documentId)).toBe(true);

    const restoreRes = await request(app).post(`/api/v1/documents/${documentId}/restore`).set(authHeader(accessToken));
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.data.deletedAt).toBeNull();

    await request(app).delete(`/api/v1/documents/${documentId}`).set(authHeader(accessToken));
    const permanentRes = await request(app).delete(`/api/v1/documents/${documentId}/permanent`).set(authHeader(accessToken));
    expect(permanentRes.status).toBe(200);

    const getRes = await request(app).get(`/api/v1/documents/${documentId}`).set(authHeader(accessToken));
    expect(getRes.status).toBe(404);
  });

  it('supports tagging, favoriting, and commenting on a document', async () => {
    const { accessToken } = await registerOrgAndLogin('Tags Fav Comments Co');

    const uploadRes = await request(app)
      .post('/api/v1/documents/upload')
      .set(authHeader(accessToken))
      .attach('file', Buffer.from('tag me'), { filename: 'tagme.txt', contentType: 'text/plain' });
    const documentId = uploadRes.body.data.id;

    const tagRes = await request(app)
      .post(`/api/v1/documents/${documentId}/tags`)
      .set(authHeader(accessToken))
      .send({ tags: ['important', 'finance'] });
    expect(tagRes.status).toBe(201);
    expect(tagRes.body.data).toHaveLength(2);

    const favRes = await request(app)
      .post(`/api/v1/documents/${documentId}/favorite`)
      .set(authHeader(accessToken))
      .send({ favorite: true });
    expect(favRes.status).toBe(200);

    const favListRes = await request(app).get('/api/v1/documents/favorites').set(authHeader(accessToken));
    expect(favListRes.body.data.some((d: { id: string }) => d.id === documentId)).toBe(true);

    const commentRes = await request(app)
      .post(`/api/v1/documents/${documentId}/comments`)
      .set(authHeader(accessToken))
      .send({ body: 'Looks good to me' });
    expect(commentRes.status).toBe(201);
  });

  it('finds an uploaded document through full-text search on its content', async () => {
    const { accessToken } = await registerOrgAndLogin('Search Co');

    await request(app)
      .post('/api/v1/documents/upload')
      .set(authHeader(accessToken))
      .attach('file', Buffer.from('unique-search-token-xyz appears here'), { filename: 'searchable.txt', contentType: 'text/plain' });

    await new Promise((resolve) => setTimeout(resolve, 300));

    const searchRes = await request(app).get('/api/v1/search?q=unique-search-token-xyz').set(authHeader(accessToken));
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.total).toBeGreaterThanOrEqual(1);
  });
});

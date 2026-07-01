import request from 'supertest';
import { app, authHeader, registerOrgAndLogin } from './helpers';

async function uploadDocument(accessToken: string) {
  const res = await request(app)
    .post('/api/v1/documents/upload')
    .set(authHeader(accessToken))
    .attach('file', Buffer.from('workflow document content'), { filename: 'wf.txt', contentType: 'text/plain' });
  return res.body.data.id as string;
}

describe('Workflow automation module', () => {
  it('runs a single-step approval workflow end-to-end', async () => {
    const { accessToken, user } = await registerOrgAndLogin('Workflow Approve Co');
    const documentId = await uploadDocument(accessToken);

    const templateRes = await request(app)
      .post('/api/v1/workflows/templates')
      .set(authHeader(accessToken))
      .send({ name: 'Simple Approval', steps: [{ name: 'Approve', stepOrder: 1, approverUserId: user.id }] });
    expect(templateRes.status).toBe(201);
    const templateId = templateRes.body.data.id;

    const instanceRes = await request(app)
      .post('/api/v1/workflows/instances')
      .set(authHeader(accessToken))
      .send({ documentId, templateId });
    expect(instanceRes.status).toBe(201);
    expect(instanceRes.body.data.status).toBe('IN_PROGRESS');
    const instanceId = instanceRes.body.data.id;

    const pendingRes = await request(app).get('/api/v1/workflows/my-approvals').set(authHeader(accessToken));
    expect(pendingRes.body.data).toHaveLength(1);
    const stepInstanceId = pendingRes.body.data[0].id;

    const actRes = await request(app)
      .post(`/api/v1/workflows/instances/${instanceId}/steps/${stepInstanceId}/action`)
      .set(authHeader(accessToken))
      .send({ action: 'APPROVE', comment: 'ok' });
    expect(actRes.status).toBe(200);
    expect(actRes.body.data.status).toBe('APPROVED');
  });

  it('rejects a workflow and skips remaining steps', async () => {
    const { accessToken, user } = await registerOrgAndLogin('Workflow Reject Co');
    const documentId = await uploadDocument(accessToken);

    const templateRes = await request(app)
      .post('/api/v1/workflows/templates')
      .set(authHeader(accessToken))
      .send({
        name: 'Two Step Approval',
        steps: [
          { name: 'Step 1', stepOrder: 1, approverUserId: user.id },
          { name: 'Step 2', stepOrder: 2, approverUserId: user.id },
        ],
      });
    const templateId = templateRes.body.data.id;

    const instanceRes = await request(app)
      .post('/api/v1/workflows/instances')
      .set(authHeader(accessToken))
      .send({ documentId, templateId });
    const instanceId = instanceRes.body.data.id;

    const pendingRes = await request(app).get('/api/v1/workflows/my-approvals').set(authHeader(accessToken));
    const stepInstanceId = pendingRes.body.data[0].id;

    const rejectRes = await request(app)
      .post(`/api/v1/workflows/instances/${instanceId}/steps/${stepInstanceId}/action`)
      .set(authHeader(accessToken))
      .send({ action: 'REJECT', comment: 'not acceptable' });

    expect(rejectRes.body.data.status).toBe('REJECTED');

    const afterPendingRes = await request(app).get('/api/v1/workflows/my-approvals').set(authHeader(accessToken));
    expect(afterPendingRes.body.data).toHaveLength(0);
  });

  it('requests and completes an e-signature with hash verification', async () => {
    const { accessToken, user } = await registerOrgAndLogin('Signature Co');
    const documentId = await uploadDocument(accessToken);

    const reqRes = await request(app)
      .post('/api/v1/signatures/requests')
      .set(authHeader(accessToken))
      .send({ documentId, signatoryUserIds: [user.id] });
    expect(reqRes.status).toBe(201);
    const signatureId = reqRes.body.data.signatories[0].id;

    const signRes = await request(app)
      .post(`/api/v1/signatures/${signatureId}/sign`)
      .set(authHeader(accessToken))
      .send({ typedName: 'Test Admin' });
    expect(signRes.status).toBe(200);
    expect(signRes.body.data.status).toBe('SIGNED');

    const verifyRes = await request(app).get(`/api/v1/signatures/${signatureId}/verify`).set(authHeader(accessToken));
    expect(verifyRes.body.data.valid).toBe(true);

    const requestDetailRes = await request(app).get(`/api/v1/signatures/requests/${reqRes.body.data.id}`).set(authHeader(accessToken));
    expect(requestDetailRes.body.data.status).toBe('COMPLETED');
  });
});

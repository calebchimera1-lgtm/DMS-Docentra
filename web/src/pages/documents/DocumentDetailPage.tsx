import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { formatBytes, formatDate } from '../../utils/format';
import { Comment, DocumentItem, DocumentVersion, WorkflowTemplate } from '../../types';
import { useAuth } from '../../store/AuthContext';

export default function DocumentDetailPage() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const [doc, setDoc] = useState<(DocumentItem & { versions: DocumentVersion[]; comments: Comment[] }) | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [shareLinks, setShareLinks] = useState<any[]>([]);
  const [signatoryEmail, setSignatoryEmail] = useState('');

  const load = useCallback(async () => {
    const res = await api.get(`/documents/${documentId}`);
    setDoc(res.data.data);
  }, [documentId]);

  useEffect(() => {
    load();
    api.get('/workflows/templates').then((res) => setTemplates(res.data.data));
    api.get(`/documents/${documentId}/share-links`).then((res) => setShareLinks(res.data.data)).catch(() => {});
  }, [load, documentId]);

  if (!doc) return <p className="muted">Loading...</p>;

  async function download() {
    const res = await api.get(`/documents/${documentId}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc!.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function toggleFavorite() {
    await api.post(`/documents/${documentId}/favorite`, { favorite: !doc!.isFavorite });
    load();
  }

  async function checkOut() {
    await api.post(`/documents/${documentId}/check-out`);
    load();
  }
  async function checkIn() {
    await api.post(`/documents/${documentId}/check-in`);
    load();
  }

  async function deleteDoc() {
    await api.delete(`/documents/${documentId}`);
    navigate('/documents');
  }

  async function uploadVersion() {
    if (!newVersionFile) return;
    const form = new FormData();
    form.append('file', newVersionFile);
    await api.post(`/documents/${documentId}/versions`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    setNewVersionFile(null);
    load();
  }

  async function addComment() {
    if (!commentBody.trim()) return;
    await api.post(`/documents/${documentId}/comments`, { body: commentBody });
    setCommentBody('');
    load();
  }

  async function initiateWorkflow() {
    if (!selectedTemplate) return;
    await api.post('/workflows/instances', { documentId, templateId: selectedTemplate });
    alert('Workflow initiated');
  }

  async function requestSignature() {
    // Look up user by email is not exposed publicly; for demo we require the requester to know the user id.
    // Here we accept a comma separated list of user IDs for simplicity of the admin UI.
    const ids = signatoryEmail.split(',').map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return;
    await api.post('/signatures/requests', { documentId, signatoryUserIds: ids });
    alert('Signature request sent');
    setSignatoryEmail('');
  }

  async function createShareLink() {
    const res = await api.post(`/documents/${documentId}/share-links`, { viewOnly: false });
    setShareLinks((links) => [res.data.data, ...links]);
  }

  return (
    <div>
      <button className="btn btn-sm mb-16" onClick={() => navigate(-1)}>&larr; Back</button>

      <div className="flex-between mb-16">
        <div>
          <h2>{doc.name}</h2>
          <p className="muted">
            {doc.fileType} &middot; {formatBytes(doc.sizeBytes)} &middot; v{doc.currentVersion} &middot;{' '}
            <span className={`badge ${doc.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>{doc.status}</span>
            {doc.isLocked && <span className="badge badge-danger" style={{ marginLeft: 6 }}>Checked out</span>}
          </p>
        </div>
        <div className="flex gap-8">
          <button className="btn" onClick={toggleFavorite}>{doc.isFavorite ? '★ Favorited' : '☆ Favorite'}</button>
          <button className="btn" onClick={download}>Download</button>
          {!doc.isLocked ? (
            <button className="btn" onClick={checkOut}>Check out</button>
          ) : (
            <button className="btn" onClick={checkIn}>Check in</button>
          )}
          {hasPermission('document:delete') && <button className="btn btn-danger" onClick={deleteDoc}>Delete</button>}
        </div>
      </div>

      <div className="grid grid-cols-2">
        <div className="card">
          <h3>Upload New Version</h3>
          <input type="file" onChange={(e) => setNewVersionFile(e.target.files?.[0] ?? null)} />
          <button className="btn btn-primary mt-16" onClick={uploadVersion} disabled={!newVersionFile}>Upload version</button>

          <h3 className="mt-16">Version History</h3>
          <table>
            <thead><tr><th>Version</th><th>Size</th><th>Comment</th><th>Date</th></tr></thead>
            <tbody>
              {doc.versions.map((v) => (
                <tr key={v.id}>
                  <td>v{v.versionNumber}</td>
                  <td className="muted">{formatBytes(v.sizeBytes)}</td>
                  <td className="muted">{v.comment ?? '-'}</td>
                  <td className="muted">{formatDate(v.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Comments</h3>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {doc.comments.map((c) => (
              <div key={c.id} className="mb-16">
                <strong>{c.user.firstName} {c.user.lastName}</strong> <span className="muted">{formatDate(c.createdAt)}</span>
                <p style={{ margin: '4px 0' }}>{c.body}</p>
              </div>
            ))}
            {doc.comments.length === 0 && <p className="muted">No comments yet</p>}
          </div>
          <textarea rows={2} value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Add a comment (use @email to mention)" />
          <button className="btn btn-primary mt-16" onClick={addComment}>Post comment</button>
        </div>

        <div className="card">
          <h3>Workflow</h3>
          <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
            <option value="">Select a workflow template</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button className="btn btn-primary mt-16" onClick={initiateWorkflow} disabled={!selectedTemplate}>Initiate approval workflow</button>
        </div>

        <div className="card">
          <h3>E-Signature</h3>
          <input placeholder="Signatory user IDs, comma separated" value={signatoryEmail} onChange={(e) => setSignatoryEmail(e.target.value)} />
          <button className="btn btn-primary mt-16" onClick={requestSignature}>Request signature</button>
        </div>

        <div className="card">
          <h3>Share Links</h3>
          <button className="btn" onClick={createShareLink}>Create share link</button>
          <table className="mt-16">
            <tbody>
              {shareLinks.map((l) => (
                <tr key={l.id}>
                  <td className="muted" style={{ wordBreak: 'break-all' }}>{l.url ?? l.token}</td>
                  <td className="muted">{l.downloadCount} downloads</td>
                </tr>
              ))}
              {shareLinks.length === 0 && <tr><td className="muted">No share links yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { DocumentItem } from '../../types';
import { formatBytes, formatDate } from '../../utils/format';

export default function RecycleBinPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  async function load() {
    const res = await api.get('/documents/recycle-bin');
    setDocuments(res.data.data.documents);
  }

  useEffect(() => {
    load();
  }, []);

  async function restore(id: string) {
    await api.post(`/documents/${id}/restore`);
    load();
  }

  async function permanentlyDelete(id: string) {
    if (!confirm('Permanently delete this document? This cannot be undone.')) return;
    await api.delete(`/documents/${id}/permanent`);
    load();
  }

  return (
    <div>
      <h2>Recycle Bin</h2>
      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Size</th><th>Deleted</th><th>Actions</th></tr></thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id}>
                <td>{doc.name}</td>
                <td className="muted">{formatBytes(doc.sizeBytes)}</td>
                <td className="muted">{doc.deletedAt ? formatDate(doc.deletedAt) : '-'}</td>
                <td className="flex gap-8">
                  <button className="btn btn-sm" onClick={() => restore(doc.id)}>Restore</button>
                  <button className="btn btn-sm btn-danger" onClick={() => permanentlyDelete(doc.id)}>Delete permanently</button>
                </td>
              </tr>
            ))}
            {documents.length === 0 && <tr><td colSpan={4} className="muted">Recycle bin is empty</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

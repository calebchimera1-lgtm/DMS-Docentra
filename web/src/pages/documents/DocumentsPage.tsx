import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { DocumentItem, Folder } from '../../types';
import { formatBytes, formatDate } from '../../utils/format';

export default function DocumentsPage() {
  const [params, setParams] = useSearchParams();
  const folderId = params.get('folderId');

  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const [foldersRes, docsRes] = await Promise.all([
      api.get('/folders', { params: { parentId: folderId ?? 'root' } }),
      api.get('/documents', { params: { folderId: folderId ?? 'root' } }),
    ]);
    setFolders(foldersRes.data.data);
    setDocuments(docsRes.data.data.documents);

    if (folderId) {
      const bcRes = await api.get(`/folders/${folderId}/breadcrumb`);
      setBreadcrumb(bcRes.data.data);
    } else {
      setBreadcrumb([]);
    }
  }, [folderId]);

  useEffect(() => {
    load();
  }, [load]);

  function openFolder(id: string | null) {
    if (id) setParams({ folderId: id });
    else setParams({});
  }

  async function createFolder() {
    if (!newFolderName.trim()) return;
    await api.post('/folders', { name: newFolderName, parentId: folderId ?? undefined });
    setNewFolderName('');
    setShowNewFolder(false);
    load();
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        if (folderId) form.append('folderId', folderId);
        await api.post('/documents/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      await load();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Documents</h2>
        <div className="flex gap-8">
          <button className="btn" onClick={() => setShowNewFolder(true)}>+ New Folder</button>
          <label className="btn btn-primary">
            {uploading ? 'Uploading...' : 'Upload'}
            <input type="file" multiple hidden onChange={(e) => uploadFiles(e.target.files)} disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="breadcrumb">
        <a onClick={() => openFolder(null)} style={{ cursor: 'pointer' }}>Root</a>
        {breadcrumb.map((b) => (
          <span key={b.id}>
            <span className="sep">/</span>
            <a onClick={() => openFolder(b.id)} style={{ cursor: 'pointer' }}>{b.name}</a>
          </span>
        ))}
      </div>

      {showNewFolder && (
        <div className="card mb-16 flex gap-8">
          <input placeholder="Folder name" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} autoFocus />
          <button className="btn btn-primary" onClick={createFolder}>Create</button>
          <button className="btn" onClick={() => setShowNewFolder(false)}>Cancel</button>
        </div>
      )}

      <div
        className={`dropzone ${dragActive ? 'active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); uploadFiles(e.dataTransfer.files); }}
      >
        Drag and drop files here to upload
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>Name</th><th>Type</th><th>Size</th><th>Updated</th></tr>
          </thead>
          <tbody>
            {folders.map((f) => (
              <tr key={f.id} onClick={() => openFolder(f.id)} style={{ cursor: 'pointer' }}>
                <td>📁 {f.name}</td>
                <td className="muted">Folder</td>
                <td>-</td>
                <td>-</td>
              </tr>
            ))}
            {documents.map((doc) => (
              <tr key={doc.id}>
                <td><Link to={`/documents/${doc.id}`}>📄 {doc.name}</Link></td>
                <td className="muted">{doc.fileType}</td>
                <td className="muted">{formatBytes(doc.sizeBytes)}</td>
                <td className="muted">{formatDate(doc.updatedAt)}</td>
              </tr>
            ))}
            {folders.length === 0 && documents.length === 0 && (
              <tr><td colSpan={4} className="muted">This folder is empty</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

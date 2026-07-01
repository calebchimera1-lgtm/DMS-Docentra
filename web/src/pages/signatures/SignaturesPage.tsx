import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { SignatureTask } from '../../types';

export default function SignaturesPage() {
  const [pending, setPending] = useState<SignatureTask[]>([]);
  const [signModalId, setSignModalId] = useState<string | null>(null);
  const [typedName, setTypedName] = useState('');

  async function load() {
    const res = await api.get('/signatures/my-pending');
    setPending(res.data.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function sign() {
    if (!signModalId || !typedName.trim()) return;
    await api.post(`/signatures/${signModalId}/sign`, { typedName });
    setSignModalId(null);
    setTypedName('');
    load();
  }

  async function decline(id: string) {
    const reason = prompt('Reason for declining (optional):') ?? undefined;
    await api.post(`/signatures/${id}/decline`, { reason });
    load();
  }

  return (
    <div>
      <h2>E-Signatures</h2>
      <div className="card">
        <h3>Pending My Signature</h3>
        <table>
          <thead><tr><th>Document</th><th>Actions</th></tr></thead>
          <tbody>
            {pending.map((s) => (
              <tr key={s.id}>
                <td><Link to={`/documents/${s.signatureRequest.document.id}`}>{s.signatureRequest.document.name}</Link></td>
                <td className="flex gap-8">
                  <button className="btn btn-sm btn-primary" onClick={() => setSignModalId(s.id)}>Sign</button>
                  <button className="btn btn-sm btn-danger" onClick={() => decline(s.id)}>Decline</button>
                </td>
              </tr>
            ))}
            {pending.length === 0 && <tr><td colSpan={2} className="muted">No pending signatures</td></tr>}
          </tbody>
        </table>
      </div>

      {signModalId && (
        <div className="modal-backdrop" onClick={() => setSignModalId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Sign document</h3>
            <div className="field">
              <label>Type your full name to sign</label>
              <input value={typedName} onChange={(e) => setTypedName(e.target.value)} autoFocus />
            </div>
            <div className="flex gap-8">
              <button className="btn btn-primary" onClick={sign}>Confirm signature</button>
              <button className="btn" onClick={() => setSignModalId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

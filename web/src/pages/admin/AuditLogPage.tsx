import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { AuditLogItem } from '../../types';
import { formatDate } from '../../utils/format';

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [action, setAction] = useState('');
  const [total, setTotal] = useState(0);

  async function load() {
    const res = await api.get('/audit-logs', { params: { action: action || undefined } });
    setLogs(res.data.data.logs);
    setTotal(res.data.data.total);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function exportCsv() {
    const res = await api.get('/audit-logs/export', { params: { action: action || undefined }, responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-logs.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Audit Logs</h2>
        <button className="btn" onClick={exportCsv}>Export CSV</button>
      </div>
      <div className="card mb-16 flex gap-8">
        <input placeholder="Filter by action (e.g. document.upload)" value={action} onChange={(e) => setAction(e.target.value)} />
        <button className="btn btn-primary" onClick={load}>Filter</button>
      </div>
      <div className="card">
        <p className="muted">{total} entries</p>
        <table>
          <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Resource</th><th>IP</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="muted">{formatDate(l.createdAt)}</td>
                <td>{l.user ? `${l.user.firstName} ${l.user.lastName}` : 'system'}</td>
                <td>{l.action}</td>
                <td className="muted">{l.resourceType ?? '-'}</td>
                <td className="muted">{l.ipAddress ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

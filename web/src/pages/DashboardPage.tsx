import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { formatBytes, formatDate } from '../utils/format';
import { DocumentItem, AuditLogItem } from '../types';

interface DashboardData {
  recentDocuments: DocumentItem[];
  favoriteDocuments: DocumentItem[];
  pendingApprovalsCount: number;
  pendingSignaturesCount: number;
  recentActivities: AuditLogItem[];
  unreadNotifications: number;
  storage: { usedBytes: string; quotaBytes: string; percentUsed: number };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get('/dashboard/me').then((res) => setData(res.data.data));
  }, []);

  if (!data) return <p className="muted">Loading dashboard...</p>;

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="grid grid-cols-4 mb-16">
        <div className="card stat-card">
          <span className="stat-value">{data.pendingApprovalsCount}</span>
          <span className="stat-label">Pending Approvals</span>
        </div>
        <div className="card stat-card">
          <span className="stat-value">{data.pendingSignaturesCount}</span>
          <span className="stat-label">Pending Signatures</span>
        </div>
        <div className="card stat-card">
          <span className="stat-value">{data.unreadNotifications}</span>
          <span className="stat-label">Unread Notifications</span>
        </div>
        <div className="card stat-card">
          <span className="stat-value">{(data.storage.percentUsed * 100).toFixed(2)}%</span>
          <span className="stat-label">Storage Used ({formatBytes(data.storage.usedBytes)} / {formatBytes(data.storage.quotaBytes)})</span>
        </div>
      </div>

      <div className="grid grid-cols-2">
        <div className="card">
          <h3>Recent Documents</h3>
          <table>
            <tbody>
              {data.recentDocuments.map((doc) => (
                <tr key={doc.id}>
                  <td><Link to={`/documents/${doc.id}`}>{doc.name}</Link></td>
                  <td className="muted">{formatBytes(doc.sizeBytes)}</td>
                </tr>
              ))}
              {data.recentDocuments.length === 0 && <tr><td className="muted">No documents yet</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Favorite Documents</h3>
          <table>
            <tbody>
              {data.favoriteDocuments.map((doc) => (
                <tr key={doc.id}>
                  <td><Link to={`/documents/${doc.id}`}>{doc.name}</Link></td>
                </tr>
              ))}
              {data.favoriteDocuments.length === 0 && <tr><td className="muted">No favorites yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt-16">
        <h3>Recent Activity</h3>
        <table>
          <thead><tr><th>Action</th><th>Resource</th><th>Time</th></tr></thead>
          <tbody>
            {data.recentActivities.map((a) => (
              <tr key={a.id}>
                <td>{a.action}</td>
                <td className="muted">{a.resourceType ?? '-'}</td>
                <td className="muted">{formatDate(a.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

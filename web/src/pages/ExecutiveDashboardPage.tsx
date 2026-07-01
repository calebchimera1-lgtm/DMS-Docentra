import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { formatBytes } from '../utils/format';

interface ExecutiveData {
  totalDocuments: number;
  totalUsers: number;
  totalFolders: number;
  workflowStatusBreakdown: { status: string; count: number }[];
  documentsByFileType: { fileType: string; count: number }[];
  departmentStats: { department: string; userCount: number }[];
  storage: { usedBytes: string; quotaBytes: string; percentUsed: number };
  activityLast30Days: number;
}

export default function ExecutiveDashboardPage() {
  const [data, setData] = useState<ExecutiveData | null>(null);

  useEffect(() => {
    api.get('/dashboard/executive').then((res) => setData(res.data.data));
  }, []);

  if (!data) return <p className="muted">Loading executive dashboard...</p>;

  return (
    <div>
      <h2>Executive Dashboard</h2>
      <div className="grid grid-cols-4 mb-16">
        <div className="card stat-card"><span className="stat-value">{data.totalDocuments}</span><span className="stat-label">Total Documents</span></div>
        <div className="card stat-card"><span className="stat-value">{data.totalUsers}</span><span className="stat-label">Active Users</span></div>
        <div className="card stat-card"><span className="stat-value">{data.totalFolders}</span><span className="stat-label">Folders</span></div>
        <div className="card stat-card"><span className="stat-value">{data.activityLast30Days}</span><span className="stat-label">Actions (30d)</span></div>
      </div>

      <div className="grid grid-cols-3">
        <div className="card">
          <h3>Workflow Status</h3>
          <table>
            <tbody>
              {data.workflowStatusBreakdown.map((w) => (
                <tr key={w.status}><td>{w.status}</td><td>{w.count}</td></tr>
              ))}
              {data.workflowStatusBreakdown.length === 0 && <tr><td className="muted">No workflows yet</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Documents by File Type</h3>
          <table>
            <tbody>
              {data.documentsByFileType.map((d) => (
                <tr key={d.fileType}><td>{d.fileType}</td><td>{d.count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Department Headcount</h3>
          <table>
            <tbody>
              {data.departmentStats.map((d) => (
                <tr key={d.department}><td>{d.department}</td><td>{d.userCount}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt-16">
        <h3>Storage</h3>
        <p>{formatBytes(data.storage.usedBytes)} used of {formatBytes(data.storage.quotaBytes)} ({(data.storage.percentUsed * 100).toFixed(3)}%)</p>
        <div style={{ background: '#eef1f6', borderRadius: 8, height: 10, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(data.storage.percentUsed * 100, 100)}%`, background: '#2952e3', height: '100%' }} />
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { formatDate } from '../../utils/format';

export default function WorkflowInstancePage() {
  const { instanceId } = useParams();
  const [instance, setInstance] = useState<any | null>(null);

  async function load() {
    const res = await api.get(`/workflows/instances/${instanceId}`);
    setInstance(res.data.data);
  }

  useEffect(() => {
    load();
  }, [instanceId]);

  if (!instance) return <p className="muted">Loading...</p>;

  return (
    <div>
      <h2>Workflow: {instance.template.name}</h2>
      <p>Status: <span className="badge badge-primary">{instance.status}</span></p>
      <p className="muted">Document: {instance.document.name}</p>

      <div className="card">
        <h3>Steps</h3>
        <table>
          <thead><tr><th>Step</th><th>Approver</th><th>Status</th><th>Comment</th><th>Acted</th></tr></thead>
          <tbody>
            {instance.steps.map((s: any) => (
              <tr key={s.id}>
                <td>{s.step?.name}</td>
                <td className="muted">{s.approver ? `${s.approver.firstName} ${s.approver.lastName}` : '-'}</td>
                <td><span className="badge">{s.status}</span></td>
                <td className="muted">{s.comment ?? '-'}</td>
                <td className="muted">{s.actedAt ? formatDate(s.actedAt) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

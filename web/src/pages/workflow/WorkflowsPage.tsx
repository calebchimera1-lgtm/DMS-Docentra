import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { WorkflowStepInstance, WorkflowTemplate } from '../../types';
import { useAuth } from '../../store/AuthContext';

export default function WorkflowsPage() {
  const { hasPermission } = useAuth();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [pending, setPending] = useState<WorkflowStepInstance[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [steps, setSteps] = useState([{ name: 'Step 1', approverUserId: '' }]);

  async function load() {
    const [templatesRes, pendingRes] = await Promise.all([
      api.get('/workflows/templates'),
      api.get('/workflows/my-approvals'),
    ]);
    setTemplates(templatesRes.data.data);
    setPending(pendingRes.data.data);
  }

  useEffect(() => {
    load();
  }, []);

  function addStep() {
    setSteps((s) => [...s, { name: `Step ${s.length + 1}`, approverUserId: '' }]);
  }

  async function createTemplate() {
    await api.post('/workflows/templates', {
      name,
      steps: steps.map((s, i) => ({ name: s.name, stepOrder: i + 1, approverUserId: s.approverUserId })),
    });
    setName('');
    setSteps([{ name: 'Step 1', approverUserId: '' }]);
    setShowCreate(false);
    load();
  }

  async function act(instanceId: string, stepInstanceId: string, action: 'APPROVE' | 'REJECT') {
    const comment = prompt(`Comment for ${action.toLowerCase()} (optional):`) ?? undefined;
    await api.post(`/workflows/instances/${instanceId}/steps/${stepInstanceId}/action`, { action, comment });
    load();
  }

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Workflows</h2>
        {hasPermission('workflow:manage') && <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>+ New Template</button>}
      </div>

      {showCreate && (
        <div className="card mb-16">
          <div className="field"><label>Template name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          {steps.map((s, i) => (
            <div className="grid grid-cols-2" key={i}>
              <div className="field">
                <label>Step {i + 1} name</label>
                <input value={s.name} onChange={(e) => setSteps((arr) => arr.map((st, idx) => idx === i ? { ...st, name: e.target.value } : st))} />
              </div>
              <div className="field">
                <label>Approver user ID</label>
                <input value={s.approverUserId} onChange={(e) => setSteps((arr) => arr.map((st, idx) => idx === i ? { ...st, approverUserId: e.target.value } : st))} />
              </div>
            </div>
          ))}
          <div className="flex gap-8">
            <button className="btn" onClick={addStep}>+ Add step</button>
            <button className="btn btn-primary" onClick={createTemplate}>Create template</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2">
        <div className="card">
          <h3>Templates</h3>
          <table>
            <thead><tr><th>Name</th><th>Steps</th></tr></thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}><td>{t.name}</td><td className="muted">{t.steps.length}</td></tr>
              ))}
              {templates.length === 0 && <tr><td className="muted" colSpan={2}>No templates yet</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>My Pending Approvals</h3>
          <table>
            <thead><tr><th>Document</th><th>Step</th><th>Actions</th></tr></thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/workflows/${p.workflowInstanceId}`}>{p.workflowInstance?.document.name}</Link></td>
                  <td className="muted">{p.step?.name}</td>
                  <td className="flex gap-8">
                    <button className="btn btn-sm" onClick={() => act(p.workflowInstanceId, p.id, 'APPROVE')}>Approve</button>
                    <button className="btn btn-sm btn-danger" onClick={() => act(p.workflowInstanceId, p.id, 'REJECT')}>Reject</button>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && <tr><td className="muted" colSpan={3}>No pending approvals</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

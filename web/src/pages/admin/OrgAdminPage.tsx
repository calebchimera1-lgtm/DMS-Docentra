import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Branch, Department } from '../../types';

export default function OrgAdminPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branchForm, setBranchForm] = useState({ name: '', code: '' });
  const [deptForm, setDeptForm] = useState({ name: '', code: '', branchId: '' });

  async function load() {
    const [branchesRes, deptsRes] = await Promise.all([api.get('/organizations/branches'), api.get('/organizations/departments')]);
    setBranches(branchesRes.data.data);
    setDepartments(deptsRes.data.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function createBranch() {
    await api.post('/organizations/branches', branchForm);
    setBranchForm({ name: '', code: '' });
    load();
  }

  async function createDepartment() {
    await api.post('/organizations/departments', { ...deptForm, branchId: deptForm.branchId || undefined });
    setDeptForm({ name: '', code: '', branchId: '' });
    load();
  }

  return (
    <div>
      <h2>Organization Settings</h2>
      <div className="grid grid-cols-2">
        <div className="card">
          <h3>Branches</h3>
          <table>
            <tbody>
              {branches.map((b) => <tr key={b.id}><td>{b.name}</td><td className="muted">{b.code}</td></tr>)}
            </tbody>
          </table>
          <div className="grid grid-cols-2 mt-16">
            <div className="field"><label>Name</label><input value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} /></div>
            <div className="field"><label>Code</label><input value={branchForm.code} onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })} /></div>
          </div>
          <button className="btn btn-primary" onClick={createBranch}>Add branch</button>
        </div>

        <div className="card">
          <h3>Departments</h3>
          <table>
            <tbody>
              {departments.map((d) => <tr key={d.id}><td>{d.name}</td><td className="muted">{d.code}</td></tr>)}
            </tbody>
          </table>
          <div className="grid grid-cols-2 mt-16">
            <div className="field"><label>Name</label><input value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} /></div>
            <div className="field"><label>Code</label><input value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} /></div>
          </div>
          <div className="field">
            <label>Branch</label>
            <select value={deptForm.branchId} onChange={(e) => setDeptForm({ ...deptForm, branchId: e.target.value })}>
              <option value="">None</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={createDepartment}>Add department</button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { UserItem } from '../../types';

export default function UsersAdminPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', password: '' });

  async function load() {
    const res = await api.get('/users');
    setUsers(res.data.data.users);
  }

  useEffect(() => {
    load();
  }, []);

  async function createUser() {
    await api.post('/users', form);
    setForm({ email: '', firstName: '', lastName: '', password: '' });
    setShowCreate(false);
    load();
  }

  async function deactivate(id: string) {
    if (!confirm('Deactivate this user?')) return;
    await api.delete(`/users/${id}`);
    load();
  }

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Users</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>+ New User</button>
      </div>

      {showCreate && (
        <div className="card mb-16 grid grid-cols-4">
          <div className="field"><label>First name</label><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
          <div className="field"><label>Last name</label><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
          <div className="field"><label>Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="field"><label>Password</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <button className="btn btn-primary" onClick={createUser}>Create</button>
        </div>
      )}

      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Roles</th><th>MFA</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.firstName} {u.lastName}</td>
                <td className="muted">{u.email}</td>
                <td className="muted">{u.roles.map((r) => r.role.name).join(', ')}</td>
                <td>{u.mfaEnabled ? <span className="badge badge-success">Enabled</span> : <span className="badge">Disabled</span>}</td>
                <td>{u.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Inactive</span>}</td>
                <td>{u.isActive && <button className="btn btn-sm btn-danger" onClick={() => deactivate(u.id)}>Deactivate</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Role } from '../../types';

interface Permission { id: string; key: string; module: string }

export default function RolesAdminPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  async function load() {
    const [rolesRes, permsRes] = await Promise.all([api.get('/organizations/roles'), api.get('/organizations/permissions')]);
    setRoles(rolesRes.data.data);
    setPermissions(permsRes.data.data);
  }

  useEffect(() => {
    load();
  }, []);

  function hasPermission(role: Role, key: string) {
    return role.permissions.some((p) => p.permission.key === key);
  }

  async function togglePermission(role: Role, key: string) {
    if (role.isSystem) return;
    const currentKeys = role.permissions.map((p) => p.permission.key);
    const newKeys = hasPermission(role, key) ? currentKeys.filter((k) => k !== key) : [...currentKeys, key];
    await api.patch(`/organizations/roles/${role.id}/permissions`, { permissionKeys: newKeys });
    load();
  }

  return (
    <div>
      <h2>Roles &amp; Permissions</h2>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Permission</th>
              {roles.map((r) => <th key={r.id}>{r.name}{r.isSystem && ' 🔒'}</th>)}
            </tr>
          </thead>
          <tbody>
            {permissions.map((p) => (
              <tr key={p.id}>
                <td>{p.key}</td>
                {roles.map((r) => (
                  <td key={r.id} style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={hasPermission(r, p.key)}
                      disabled={r.isSystem}
                      onChange={() => togglePermission(r, p.key)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted mt-16">🔒 System roles ship with fixed permissions and cannot be edited.</p>
      </div>
    </div>
  );
}

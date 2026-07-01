import { ReactNode, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { api } from '../services/api';
import { useSocket } from '../hooks/useSocket';

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  async function loadUnread() {
    try {
      const res = await api.get('/notifications', { params: { unreadOnly: true, pageSize: 1 } });
      setUnread(res.data.data.unreadCount);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  useSocket(() => setUnread((n) => n + 1));

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const isAdmin = hasPermission('admin:users') || hasPermission('admin:roles') || hasPermission('admin:org_settings');

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">DOCENTRA</div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/documents">Documents</NavLink>
          <NavLink to="/documents/recycle-bin">Recycle Bin</NavLink>
          <NavLink to="/search">Search</NavLink>
          <NavLink to="/workflows">Workflows</NavLink>
          <NavLink to="/signatures">Signatures</NavLink>
          <NavLink to="/notifications">Notifications{unread > 0 && <span className="notif-dot">{unread}</span>}</NavLink>

          {hasPermission('reports:view') && (
            <>
              <div className="section-label">Reports</div>
              <NavLink to="/dashboard/executive">Executive Dashboard</NavLink>
            </>
          )}

          {hasPermission('audit:view') && <NavLink to="/audit-logs">Audit Logs</NavLink>}

          {isAdmin && (
            <>
              <div className="section-label">Administration</div>
              {hasPermission('admin:users') && <NavLink to="/admin/users">Users</NavLink>}
              {hasPermission('admin:roles') && <NavLink to="/admin/roles">Roles &amp; Permissions</NavLink>}
              {hasPermission('admin:org_settings') && <NavLink to="/admin/organization">Organization</NavLink>}
            </>
          )}
        </nav>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <span className="muted">{user?.email}</span>
          <span className="badge badge-primary">{user?.roles?.[0]}</span>
          <button className="btn btn-sm" onClick={handleLogout}>Log out</button>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}

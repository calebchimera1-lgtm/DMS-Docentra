import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './store/AuthContext';
import { AppLayout } from './components/AppLayout';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import MfaVerifyPage from './pages/auth/MfaVerifyPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

import DashboardPage from './pages/DashboardPage';
import ExecutiveDashboardPage from './pages/ExecutiveDashboardPage';
import DocumentsPage from './pages/documents/DocumentsPage';
import DocumentDetailPage from './pages/documents/DocumentDetailPage';
import RecycleBinPage from './pages/documents/RecycleBinPage';
import SearchPage from './pages/SearchPage';
import WorkflowsPage from './pages/workflow/WorkflowsPage';
import WorkflowInstancePage from './pages/workflow/WorkflowInstancePage';
import SignaturesPage from './pages/signatures/SignaturesPage';
import NotificationsPage from './pages/NotificationsPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import UsersAdminPage from './pages/admin/UsersAdminPage';
import RolesAdminPage from './pages/admin/RolesAdminPage';
import OrgAdminPage from './pages/admin/OrgAdminPage';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="content">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/mfa" element={<MfaVerifyPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/dashboard/executive" element={<ExecutiveDashboardPage />} />
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="/documents/recycle-bin" element={<RecycleBinPage />} />
                <Route path="/documents/:documentId" element={<DocumentDetailPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/workflows" element={<WorkflowsPage />} />
                <Route path="/workflows/:instanceId" element={<WorkflowInstancePage />} />
                <Route path="/signatures" element={<SignaturesPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/admin/users" element={<UsersAdminPage />} />
                <Route path="/admin/roles" element={<RolesAdminPage />} />
                <Route path="/admin/organization" element={<OrgAdminPage />} />
                <Route path="/audit-logs" element={<AuditLogPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

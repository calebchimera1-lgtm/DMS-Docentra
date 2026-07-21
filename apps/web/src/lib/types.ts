export interface CurrentUser {
  id: string;
  companyId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  avatarUrl: string | null;
  effectivePermissions: string[];
  branches: { branch: { id: string; name: string; code: string } }[];
  roles: { role: { id: string; name: string } }[];
}

export interface DashboardSummary {
  branchCount: number;
  activeUserCount: number;
  totalUserCount: number;
  unreadNotificationCount: number;
}

export interface ActivityByAction {
  action: string;
  count: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}

export interface LoginResult {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  mfaRequired?: true;
  mfaToken?: string;
}

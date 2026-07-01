export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  isArchive: boolean;
  colorCode?: string | null;
}

export interface DocumentTagLink {
  documentId: string;
  tagId: string;
  tag: { id: string; name: string; colorCode?: string | null };
}

export interface DocumentItem {
  id: string;
  name: string;
  description?: string | null;
  fileType: string;
  mimeType: string;
  sizeBytes: string;
  currentVersion: number;
  category?: string | null;
  documentNumber?: string | null;
  status: string;
  confidentiality: string;
  isLocked: boolean;
  isFavorite: boolean;
  lockedById?: string | null;
  folderId?: string | null;
  ocrText?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  createdBy?: { id: string; firstName: string; lastName: string; email: string };
  tags?: DocumentTagLink[];
}

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  sizeBytes: string;
  comment?: string | null;
  createdAt: string;
  createdBy?: { id: string; firstName: string; lastName: string };
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string };
}

export interface WorkflowStepInstance {
  id: string;
  workflowInstanceId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELEGATED' | 'SKIPPED';
  comment?: string | null;
  dueAt?: string | null;
  workflowInstance?: { id: string; document: DocumentItem; template: { name: string } };
  step?: { name: string };
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  steps: { id: string; name: string; stepOrder: number; approverRoleId?: string | null; approverUserId?: string | null }[];
}

export interface SignatureTask {
  id: string;
  status: 'PENDING' | 'SIGNED' | 'DECLINED';
  signatureRequest: { id: string; document: DocumentItem };
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  user?: { firstName: string; lastName: string; email: string } | null;
}

export interface UserItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  mfaEnabled: boolean;
  departmentId?: string | null;
  branchId?: string | null;
  roles: { role: { id: string; name: string } }[];
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  permissions: { permission: { id: string; key: string; module: string } }[];
}

export interface Department {
  id: string;
  name: string;
  code: string;
  branchId?: string | null;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
}

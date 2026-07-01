import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { api, setTokens, getAccessToken } from '../services/api';
import { AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, organizationSlug?: string) => Promise<{ mfaRequired: boolean; mfaChallengeToken?: string }>;
  verifyMfa: (mfaChallengeToken: string, code: string) => Promise<void>;
  register: (input: { organizationName: string; email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshMe() {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string, organizationSlug?: string) {
    const res = await api.post('/auth/login', { email, password, organizationSlug });
    if (res.data.data.mfaRequired) {
      return { mfaRequired: true, mfaChallengeToken: res.data.data.mfaChallengeToken };
    }
    setTokens(res.data.data);
    setUser(res.data.data.user);
    return { mfaRequired: false };
  }

  async function verifyMfa(mfaChallengeToken: string, code: string) {
    const res = await api.post('/auth/login/mfa', { mfaChallengeToken, code });
    setTokens(res.data.data);
    setUser(res.data.data.user);
  }

  async function register(input: { organizationName: string; email: string; password: string; firstName: string; lastName: string }) {
    await api.post('/auth/register', input);
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      setTokens(null);
      setUser(null);
    }
  }

  function hasPermission(permission: string) {
    return user?.permissions.includes(permission) ?? false;
  }

  const value = useMemo(
    () => ({ user, loading, login, verifyMfa, register, logout, refreshMe, hasPermission }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

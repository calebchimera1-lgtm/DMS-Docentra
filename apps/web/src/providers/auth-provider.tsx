"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiClient, onAuthFailure } from "../lib/api-client";
import { clearStoredTokens, getStoredTokens, setStoredTokens } from "../lib/auth-storage";
import type { CurrentUser, LoginResult } from "../lib/types";

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const loadUser = useCallback(async () => {
    if (!getStoredTokens()) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const me = await apiClient.get<CurrentUser>("/users/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    onAuthFailure(() => {
      setUser(null);
      router.push("/login");
    });
    void loadUser();
    // Intentionally runs once on mount only — loadUser/router are stable
    // across renders (loadUser is memoized, router is a Next.js singleton).
  }, [loadUser, router]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const result = await apiClient.post<LoginResult>("/auth/login", { email, password }, { skipAuth: true });
    if (result.accessToken && result.refreshToken) {
      setStoredTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      await loadUser();
    }
    return result;
  }, [loadUser]);

  const verifyMfa = useCallback(async (mfaToken: string, code: string): Promise<void> => {
    const result = await apiClient.post<{ accessToken: string; refreshToken: string }>(
      "/auth/mfa/verify",
      { mfaToken, code },
      { skipAuth: true },
    );
    setStoredTokens(result);
    await loadUser();
  }, [loadUser]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Best-effort — the token gets cleared client-side either way.
    }
    clearStoredTokens();
    setUser(null);
    router.push("/login");
  }, [router]);

  const value = useMemo(
    () => ({ user, isLoading, login, verifyMfa, logout, refreshUser: loadUser }),
    [user, isLoading, login, verifyMfa, logout, loadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

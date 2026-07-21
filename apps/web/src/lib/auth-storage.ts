const ACCESS_TOKEN_KEY = "omniflow.accessToken";
const REFRESH_TOKEN_KEY = "omniflow.refreshToken";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getStoredTokens(): StoredTokens | null {
  if (!isBrowser()) return null;
  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export function setStoredTokens(tokens: StoredTokens): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearStoredTokens(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

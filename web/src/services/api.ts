import axios, { AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export const api = axios.create({ baseURL: API_BASE_URL });

let accessToken: string | null = localStorage.getItem('docentra_access_token');
let refreshToken: string | null = localStorage.getItem('docentra_refresh_token');

export function setTokens(tokens: { accessToken: string; refreshToken: string } | null) {
  accessToken = tokens?.accessToken ?? null;
  refreshToken = tokens?.refreshToken ?? null;
  if (tokens) {
    localStorage.setItem('docentra_access_token', tokens.accessToken);
    localStorage.setItem('docentra_refresh_token', tokens.refreshToken);
  } else {
    localStorage.removeItem('docentra_access_token');
    localStorage.removeItem('docentra_refresh_token');
  }
}

export function getAccessToken() {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshToken) return null;
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
      .then((res) => {
        const tokens = res.data.data;
        setTokens(tokens);
        return tokens.accessToken as string;
      })
      .catch(() => {
        setTokens(null);
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes('/auth/login')) {
      original._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

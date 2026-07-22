import { clearStoredTokens, getStoredTokens, setStoredTokens } from "./auth-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type AuthFailureListener = () => void;
let authFailureListener: AuthFailureListener | null = null;

/** The dashboard layout registers a callback here to redirect to /login when a refresh fails. */
export function onAuthFailure(listener: AuthFailureListener): void {
  authFailureListener = listener;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const tokens = getStoredTokens();
  if (!tokens) return null;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as { accessToken: string; refreshToken: string };
        setStoredTokens(data);
        return data.accessToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  skipAuth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const tokens = getStoredTokens();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (tokens && !options.skipAuth) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && !options.skipAuth && !isRetry) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      return request<T>(path, options, true);
    }
    clearStoredTokens();
    authFailureListener?.();
    throw new ApiError("Session expired", 401, null);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type");
  const body = contentType?.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const message = (body && typeof body === "object" && "message" in body ? (body as { message: string }).message : null) ?? "Request failed";
    throw new ApiError(Array.isArray(message) ? message.join(", ") : message, res.status, body);
  }

  return body as T;
}

async function uploadFile<T>(path: string, formData: FormData): Promise<T> {
  const tokens = getStoredTokens();
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {},
    body: formData,
  });

  const body = await res.json();
  if (!res.ok) {
    const message = (body && typeof body === "object" && "message" in body ? body.message : null) ?? "Upload failed";
    throw new ApiError(Array.isArray(message) ? message.join(", ") : message, res.status, body);
  }
  return body as T;
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method">) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method">) =>
    request<T>(path, { ...options, method: "DELETE" }),
  upload: uploadFile,
};

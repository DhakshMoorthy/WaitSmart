import { getAuth, setTokens, logout } from './auth';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: Error) => void;
}> = [];

function processQueue(error: Error | null, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else if (token) resolve(token);
  });
  failedQueue = [];
}

interface ApiOptions extends RequestInit {
  _retry?: boolean;
  body?: unknown;
}

export async function api(path: string, options: ApiOptions = {}) {
  const { accessToken } = getAuth();

  const config: RequestInit & { body?: BodyInit | null } = {
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  };

  if (
    config.body &&
    typeof config.body === 'object' &&
    !(config.body instanceof FormData)
  ) {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(`${BASE_URL}${path}`, config);

  if (res.status === 401 && !options._retry) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token) => {
            options.headers = {
              ...options.headers,
              Authorization: `Bearer ${token}`,
            };
            options._retry = true;
            resolve(api(path, options));
          },
          reject,
        });
      });
    }

    isRefreshing = true;
    try {
      const { refreshToken } = getAuth();
      if (!refreshToken) throw new Error('No refresh token');

      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!refreshRes.ok) throw new Error('Refresh failed');

      const data = await refreshRes.json();
      setTokens(data.accessToken, data.refreshToken);
      processQueue(null, data.accessToken);

      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${data.accessToken}`,
      };
      options._retry = true;
      return api(path, options);
    } catch (err) {
      processQueue(err as Error, null);
      logout();
      throw err;
    } finally {
      isRefreshing = false;
    }
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const error = new Error(errData.message || `Request failed: ${res.status}`) as Error & {
      status?: number;
      data?: unknown;
    };
    error.status = res.status;
    error.data = errData;
    throw error;
  }

  return res.json();
}

export function get(path: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  const url = query ? `${path}?${query}` : path;
  return api(url);
}

export function post(path: string, body: unknown) {
  return api(path, { method: 'POST', body });
}

export function patch(path: string, body: unknown) {
  return api(path, { method: 'PATCH', body });
}

export function del(path: string) {
  return api(path, { method: 'DELETE' });
}

/** Multipart upload — do not set Content-Type (browser sets boundary). */
export async function uploadFile(file: File) {
  const { accessToken } = getAuth();
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${BASE_URL}/files/upload`, {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: form,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Upload failed: ${res.status}`);
  }
  return res.json();
}

/** Ping /health so a spun-down free-tier API can wake before the user taps Send OTP. */
export function wakeApi() {
  return fetch(`${BASE_URL}/health`).catch(() => {});
}

export function apiBaseUrl() {
  return BASE_URL;
}

/**
 * Sign out: clear local auth immediately, then tell the server to revoke the refresh token
 * (best effort - a network failure must never keep the user signed in locally).
 */
export function logoutAndRevoke() {
  const { refreshToken } = getAuth();
  logout();
  if (!refreshToken) return;
  fetch(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => {});
}

import { getAuth, setTokens, logout } from "./auth.js";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
}

export async function api(path, options = {}) {
  const { accessToken } = getAuth();

  const config = {
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  };

  if (config.body && typeof config.body === "object" && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(`${BASE_URL}${path}`, config);

  if (res.status === 401 && !options._retry) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token) => {
            options.headers = { ...options.headers, Authorization: `Bearer ${token}` };
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
      if (!refreshToken) throw new Error("No refresh token");

      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!refreshRes.ok) throw new Error("Refresh failed");

      const data = await refreshRes.json();
      setTokens(data.accessToken, data.refreshToken);
      processQueue(null, data.accessToken);

      options.headers = { ...options.headers, Authorization: `Bearer ${data.accessToken}` };
      options._retry = true;
      return api(path, options);
    } catch (err) {
      processQueue(err, null);
      logout();
      throw err;
    } finally {
      isRefreshing = false;
    }
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const error = new Error(errData.message || `Request failed: ${res.status}`);
    error.status = res.status;
    error.data = errData;
    throw error;
  }

  return res.json();
}

export function get(path, params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = query ? `${path}?${query}` : path;
  return api(url);
}

export function post(path, body) {
  return api(path, { method: "POST", body });
}

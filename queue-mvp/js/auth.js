const AUTH_KEYS = {
  access: "ws_access",
  refresh: "ws_refresh",
  user: "ws_user",
};

const state = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
};

const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn({ ...state }));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getAuth() {
  return { ...state };
}

export function setTokens(access, refresh) {
  state.accessToken = access;
  state.refreshToken = refresh;
  state.isAuthenticated = true;
  localStorage.setItem(AUTH_KEYS.access, access);
  localStorage.setItem(AUTH_KEYS.refresh, refresh);
  notify();
}

export function setUser(user) {
  state.user = user;
  localStorage.setItem(AUTH_KEYS.user, JSON.stringify(user));
  notify();
}

export function logout() {
  state.user = null;
  state.accessToken = null;
  state.refreshToken = null;
  state.isAuthenticated = false;
  localStorage.removeItem(AUTH_KEYS.access);
  localStorage.removeItem(AUTH_KEYS.refresh);
  localStorage.removeItem(AUTH_KEYS.user);
  notify();
}

export function hydrate() {
  const access = localStorage.getItem(AUTH_KEYS.access);
  const refresh = localStorage.getItem(AUTH_KEYS.refresh);
  const userData = localStorage.getItem(AUTH_KEYS.user);

  if (access && refresh) {
    state.accessToken = access;
    state.refreshToken = refresh;
    state.isAuthenticated = true;
    state.user = userData ? JSON.parse(userData) : null;
  }
  state.isLoading = false;
  notify();
}

export function isAdminRole() {
  const role = state.user?.role;
  return role === "admin" || role === "doctor" || role === "superadmin";
}

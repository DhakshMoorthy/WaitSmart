let currentPath = "/";
let params = {};
const routes = {};
const listeners = [];

export function register(path, handler) {
  routes[path] = handler;
}

export function navigate(path, newParams = {}) {
  params = { ...newParams };
  currentPath = normalizePath(path);
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") qs.set(k, String(v));
  });
  const query = qs.toString();
  const url = query ? `${currentPath}?${query}` : currentPath;
  window.history.pushState({ path: currentPath, params }, "", url);
  render();
}

export function replace(path, newParams = {}) {
  params = { ...newParams };
  currentPath = normalizePath(path);
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") qs.set(k, String(v));
  });
  const query = qs.toString();
  const url = query ? `${currentPath}?${query}` : currentPath;
  window.history.replaceState({ path: currentPath, params }, "", url);
  render();
}

export function back() {
  window.history.back();
}

export function getParams() {
  return params;
}

export function getCurrentPath() {
  return currentPath;
}

export function subscribe(fn) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

function normalizePath(path) {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path.replace(/\/+$/, "") || "/" : `/${path}`;
}

function render() {
  const root = document.getElementById("app");
  const handler = routes[currentPath];
  if (handler) {
    handler(root);
  } else {
    root.innerHTML = `<div class="page"><div class="empty-state"><h3>Page not found</h3></div></div>`;
  }
  listeners.forEach((fn) => fn(currentPath));
}

function parseLocation() {
  if (window.location.hash && window.location.hash.startsWith("#/")) {
    const hashPath = window.location.hash.slice(1);
    const [path, queryStr] = hashPath.split("?");
    currentPath = normalizePath(path);
    params = Object.fromEntries(new URLSearchParams(queryStr || ""));
    window.history.replaceState({ path: currentPath, params }, "", buildUrl(currentPath, params));
    return;
  }

  currentPath = normalizePath(window.location.pathname);
  params = Object.fromEntries(new URLSearchParams(window.location.search));
}

function buildUrl(path, p) {
  const qs = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => {
    if (v != null && v !== "") qs.set(k, String(v));
  });
  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}

export function init() {
  window.addEventListener("popstate", (e) => {
    if (e.state?.path) {
      currentPath = e.state.path;
      params = e.state.params || {};
    } else {
      parseLocation();
    }
    render();
  });

  parseLocation();
  render();
}

let currentPath = "/";
let params = {};
const routes = {};
const listeners = [];

export function register(path, handler) {
  routes[path] = handler;
}

export function navigate(path, newParams = {}) {
  params = newParams;
  currentPath = path;
  window.history.pushState({ path, params }, "", `#${path}`);
  render();
}

export function replace(path, newParams = {}) {
  params = newParams;
  currentPath = path;
  window.history.replaceState({ path, params }, "", `#${path}`);
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

export function init() {
  window.addEventListener("popstate", (e) => {
    if (e.state?.path) {
      currentPath = e.state.path;
      params = e.state.params || {};
    } else {
      parseHash();
    }
    render();
  });

  parseHash();
  render();
}

function parseHash() {
  const hash = window.location.hash.slice(1) || "/";
  const [path] = hash.split("?");
  currentPath = path || "/";
  params = {};
}

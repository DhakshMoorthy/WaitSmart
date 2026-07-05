let currentPage = null;
let params = {};
const routes = {};
const appEl = () => document.getElementById("app");

export function register(path, renderFn) {
  routes[path] = renderFn;
}

export function navigate(path, newParams = {}) {
  params = newParams;
  window.history.pushState({ path, params }, "", `#${path}`);
  render(path);
}

export function replace(path, newParams = {}) {
  params = newParams;
  window.history.replaceState({ path, params }, "", `#${path}`);
  render(path);
}

export function back() {
  window.history.back();
}

export function getParams() {
  return { ...params };
}

function render(path) {
  const renderFn = routes[path];
  if (!renderFn) {
    appEl().innerHTML = `<div class="page"><div class="page-content"><div class="empty-state"><h3>Page not found</h3></div></div></div>`;
    return;
  }
  currentPage = path;
  const el = appEl();
  el.innerHTML = "";
  el.classList.add("fade-in");
  renderFn(el);
  setTimeout(() => el.classList.remove("fade-in"), 300);
}

export function init() {
  window.addEventListener("popstate", (e) => {
    if (e.state) {
      params = e.state.params || {};
      render(e.state.path);
    }
  });

  const hash = window.location.hash.slice(1);
  if (hash && routes[hash]) {
    render(hash);
  }
}

export function getCurrentPage() {
  return currentPage;
}

import { navigate, back } from "./router.js";

export const HOSPITAL_NAME = "KVT Hospital";
export const ADMIN_PASSCODE = "4321";
export const ADMIN_SESSION_KEY = "waitsmart-admin-auth";

export function isAdminAuthenticated() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
}

export function setAdminAuthenticated() {
  sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
}

export function clearAdminAuth() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderShell(root, opts = {}) {
  const {
    showBack = false,
    showHeader = true,
    showAdminLink = true,
    title = "",
    subtitle = "",
    content = "",
    footer = false,
    adminMode = false,
  } = opts;

  root.innerHTML = `
    <div class="page">
      ${showHeader ? `
        <header class="site-header">
          ${showBack ? `<button class="back-btn" id="back-btn" aria-label="Back">‹</button>` : `
            <a href="/" class="brand" data-link="/">
              <span class="brand-logo">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 2v2M7 4l1 1M17 4l-1 1"/><path d="M12 6a5 5 0 0 0-5 5v1H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2v-1a5 5 0 0 0-5-5z"/></svg>
              </span>
              <span class="brand-text">
                <strong>${HOSPITAL_NAME}</strong>
                <small>LIVE QUEUE</small>
              </span>
            </a>
          `}
          ${showAdminLink ? `
            <a href="/admin" class="admin-link" data-link="/admin">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Admin
            </a>
          ` : adminMode ? `<span class="admin-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Admin</span>` : ""}
        </header>
      ` : ""}

      ${title ? `
        <div class="page-title-block">
          ${subtitle ? `<p class="eyebrow">${escapeHtml(subtitle)}</p>` : ""}
          <h1 class="page-title">${escapeHtml(title)}</h1>
        </div>
      ` : ""}

      ${content}

      ${footer ? `<footer class="site-footer">Built for ${HOSPITAL_NAME} • Live queue powered by WebSockets</footer>` : ""}
    </div>
  `;

  root.querySelectorAll("[data-link]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(el.dataset.link);
    });
  });

  const backBtn = root.querySelector("#back-btn");
  if (backBtn) backBtn.addEventListener("click", () => back());
}

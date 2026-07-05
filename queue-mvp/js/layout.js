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

export function renderShell(root, { showBack = false, title = "", subtitle = "", content = "", footer = true } = {}) {
  root.innerHTML = `
    <div class="page">
      <header class="site-header">
        <a href="/" class="brand" data-link="/">
          <span class="brand-icon">🏥</span>
          <span class="brand-text">
            <strong>${HOSPITAL_NAME}</strong>
            <small>Live Queue</small>
          </span>
        </a>
        <a href="/admin" class="admin-link" data-link="/admin">Admin</a>
      </header>

      ${title ? `
        <div class="page-header">
          ${showBack ? `<button class="back-btn" id="back-btn">←</button>` : ""}
          <div>
            <h2>${title}</h2>
            ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}
          </div>
        </div>
      ` : ""}

      ${content}

      ${footer ? `
        <footer class="site-footer">
          Built for ${HOSPITAL_NAME} • Live queue powered by WebSockets
        </footer>
      ` : ""}
    </div>
  `;

  root.querySelectorAll("[data-link]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(el.dataset.link);
    });
  });

  const backBtn = root.querySelector("#back-btn");
  if (backBtn) {
    backBtn.addEventListener("click", () => back());
  }
}

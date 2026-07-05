import { renderShell, ADMIN_PASSCODE, isAdminAuthenticated, setAdminAuthenticated } from "../layout.js";
import { renderAdminDashboard } from "./admin.js";

export function renderAdminLogin(root) {
  if (isAdminAuthenticated()) {
    renderAdminDashboard(root);
    return;
  }

  renderShell(root, {
    showHeader: true,
    showAdminLink: false,
    content: `
      <div class="page-content admin-login-page">
        <div class="login-card">
          <div class="login-lock">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h2>Doctor / Admin access</h2>
          <p class="login-sub">Enter the shared passcode to manage queues.</p>
          <form id="login-form" class="login-form">
            <div class="form-group">
              <label for="passcode">Passcode</label>
              <input type="password" id="passcode" inputmode="numeric" maxlength="8" placeholder="Enter passcode" autocomplete="off" required />
            </div>
            <p class="error-msg" id="error-msg" style="display:none;"></p>
            <button type="submit" class="btn btn-primary btn-lg btn-block">Continue</button>
          </form>
          <p class="login-hint">Default passcode for demo: ${ADMIN_PASSCODE}</p>
        </div>
      </div>
    `,
  });

  root.querySelector("#login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = root.querySelector("#passcode");
    const errorEl = root.querySelector("#error-msg");
    if (input.value.trim() === ADMIN_PASSCODE) {
      setAdminAuthenticated();
      renderAdminDashboard(root);
    } else {
      errorEl.textContent = "Incorrect passcode. Please try again.";
      errorEl.style.display = "block";
      input.value = "";
    }
  });
}

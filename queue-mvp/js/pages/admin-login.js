import { renderShell, ADMIN_PASSCODE, isAdminAuthenticated, setAdminAuthenticated } from "../layout.js";
import { renderAdminDashboard } from "./admin.js";

export function renderAdminLogin(root) {
  if (isAdminAuthenticated()) {
    renderAdminDashboard(root);
    return;
  }

  renderShell(root, {
    footer: false,
    content: `
      <div class="page-content admin-login-page">
        <div class="login-card">
          <div class="login-icon">🔐</div>
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

  const form = root.querySelector("#login-form");
  const errorEl = root.querySelector("#error-msg");
  const input = root.querySelector("#passcode");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = input.value.trim();

    if (code === ADMIN_PASSCODE) {
      setAdminAuthenticated();
      renderAdminDashboard(root);
      return;
    }

    errorEl.textContent = "Incorrect passcode. Please try again.";
    errorEl.style.display = "block";
    input.value = "";
    input.focus();
  });
}

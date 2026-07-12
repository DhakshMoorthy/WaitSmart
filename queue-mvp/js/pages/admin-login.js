import { post } from "../api.js";
import { setTokens, setUser, isAdminRole } from "../auth.js";
import { renderShell, isAdminAuthenticated, clearAdminAuth } from "../layout.js";
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
          <p class="login-sub">Sign in with your clinic account to manage queues.</p>
          <form id="login-form" class="login-form">
            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" class="input" placeholder="admin@apollo.waitsmart.app" autocomplete="username" required />
            </div>
            <div class="form-group">
              <label for="password">Password</label>
              <input type="password" id="password" class="input" placeholder="Password" autocomplete="current-password" required />
            </div>
            <p class="error-msg" id="error-msg" style="display:none;"></p>
            <button type="submit" class="btn btn-primary btn-lg btn-block">Sign in</button>
          </form>
        </div>
      </div>
    `,
  });

  root.querySelector("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = root.querySelector("#email").value.trim();
    const password = root.querySelector("#password").value;
    const errorEl = root.querySelector("#error-msg");
    const btn = root.querySelector('button[type="submit"]');

    btn.disabled = true;
    btn.textContent = "Signing in…";
    errorEl.style.display = "none";

    try {
      const data = await post("/auth/login", { email, password });
      setTokens(data.accessToken, data.refreshToken);
      setUser({
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        phone: data.user.phone || null,
        role: data.user.role,
        tenantId: data.user.tenantId || null,
        doctorId: data.user.doctorId || null,
      });

      if (!isAdminRole()) {
        clearAdminAuth();
        errorEl.textContent = "This account does not have admin or doctor access.";
        errorEl.style.display = "block";
        return;
      }

      renderAdminDashboard(root);
    } catch (err) {
      errorEl.textContent = err.message || "Sign in failed. Check your credentials.";
      errorEl.style.display = "block";
    } finally {
      btn.disabled = false;
      btn.textContent = "Sign in";
    }
  });
}

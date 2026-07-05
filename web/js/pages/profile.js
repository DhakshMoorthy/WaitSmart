import { getAuth, logout } from "../auth.js";
import { replace, back } from "../router.js";
import { disconnectSocket } from "../socket.js";

export function renderProfile(root) {
  const { user } = getAuth();

  root.innerHTML = `
    <div class="page">
      <div class="page-header">
        <button class="back-btn" id="back-btn">← Back</button>
        <h2>Profile</h2>
      </div>
      <div class="page-content">
        <div style="display:flex; flex-direction:column; align-items:center; padding:24px 0;">
          <div class="avatar avatar-lg">${user?.name?.charAt(0)?.toUpperCase() || "?"}</div>
          <h3 class="mt-12">${user?.name || "Patient"}</h3>
          <span class="badge badge-primary mt-8">${user?.role || "patient"}</span>
        </div>

        <div class="card">
          <div class="summary-list">
            <div class="summary-row">
              <span class="label">Email</span>
              <span class="value">${user?.email || "Not set"}</span>
            </div>
            <div class="summary-row">
              <span class="label">Phone</span>
              <span class="value">${user?.phone || "Not set"}</span>
            </div>
            <div class="summary-row" style="border-bottom:none;">
              <span class="label">Role</span>
              <span class="value" style="text-transform:capitalize;">${user?.role || "patient"}</span>
            </div>
          </div>
        </div>

        <button class="btn btn-danger mt-24" id="logout-btn">Logout</button>
      </div>
    </div>
  `;

  root.querySelector("#back-btn").addEventListener("click", () => back());

  root.querySelector("#logout-btn").addEventListener("click", () => {
    if (confirm("Are you sure you want to logout?")) {
      disconnectSocket();
      logout();
      replace("/login");
    }
  });
}

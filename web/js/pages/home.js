import { getAuth } from "../auth.js";
import { navigate } from "../router.js";

export function renderHome(root) {
  const { user } = getAuth();
  const name = user?.name || "there";

  root.innerHTML = `
    <div class="page">
      <div class="page-content">
        <div class="mb-24">
          <h2>Hello, ${name}</h2>
          <p class="text-muted mt-4">How are you feeling today?</p>
        </div>

        <div class="hero-card">
          <h3>Book an Appointment</h3>
          <p>Find a clinic, choose your doctor, and book a slot instantly.</p>
          <button class="btn" id="book-now-btn">Book Now</button>
        </div>

        <div class="mb-24">
          <h3 class="mb-12">Quick Actions</h3>
          <div class="quick-actions">
            <div class="quick-action-card" id="goto-bookings">
              <div class="icon">📋</div>
              <div class="label">My Bookings</div>
            </div>
            <div class="quick-action-card" id="goto-profile">
              <div class="icon">👤</div>
              <div class="label">Profile</div>
            </div>
          </div>
        </div>

        <div>
          <h3 class="mb-12">How it works</h3>
          <div class="card" style="border:none; background:var(--bg); padding:16px 20px;">
            <div style="display:flex; flex-direction:column; gap:14px;">
              <div style="display:flex; align-items:center; gap:12px;">
                <span class="badge badge-primary" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;">1</span>
                <span style="font-size:0.88rem; color:var(--text-secondary);">Select a clinic near you</span>
              </div>
              <div style="display:flex; align-items:center; gap:12px;">
                <span class="badge badge-primary" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;">2</span>
                <span style="font-size:0.88rem; color:var(--text-secondary);">Choose your doctor & time</span>
              </div>
              <div style="display:flex; align-items:center; gap:12px;">
                <span class="badge badge-primary" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;">3</span>
                <span style="font-size:0.88rem; color:var(--text-secondary);">Get your token instantly</span>
              </div>
              <div style="display:flex; align-items:center; gap:12px;">
                <span class="badge badge-primary" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;">4</span>
                <span style="font-size:0.88rem; color:var(--text-secondary);">Track your queue live</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="bottom-nav">
        <button class="nav-item active">
          <span class="nav-icon">🏠</span>Home
        </button>
        <button class="nav-item" id="nav-bookings">
          <span class="nav-icon">📋</span>Bookings
        </button>
        <button class="nav-item" id="nav-profile">
          <span class="nav-icon">👤</span>Profile
        </button>
      </div>
    </div>
  `;

  root.querySelector("#book-now-btn").addEventListener("click", () => navigate("/clinics"));
  root.querySelector("#goto-bookings").addEventListener("click", () => navigate("/bookings"));
  root.querySelector("#goto-profile").addEventListener("click", () => navigate("/profile"));
  root.querySelector("#nav-bookings").addEventListener("click", () => navigate("/bookings"));
  root.querySelector("#nav-profile").addEventListener("click", () => navigate("/profile"));
}

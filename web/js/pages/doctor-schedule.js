import { get } from "../api.js";
import { getAuth } from "../auth.js";
import { navigate, back } from "../router.js";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function renderDoctorSchedule(root) {
  const { user } = getAuth();
  const doctorId = user?.doctorId;

  if (!doctorId) {
    root.innerHTML = `
      <div class="page">
        <div class="page-content">
          <div class="empty-state">
            <div class="icon">⚠️</div>
            <h3>No doctor profile</h3>
            <p>No doctor profile is linked to this account.</p>
          </div>
        </div>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="page">
      <div class="page-header">
        <button class="back-btn" id="back-btn">← Back</button>
        <h2>My Schedule</h2>
        <p class="subtitle">Weekly availability</p>
      </div>
      <div class="page-content" id="schedule-content">
        <div class="loading"><div class="spinner"></div><span class="loading-text">Loading schedule...</span></div>
      </div>
      <div class="bottom-nav">
        <button class="nav-item" id="nav-queue">
          <span class="nav-icon">📋</span>Queue
        </button>
        <button class="nav-item active">
          <span class="nav-icon">🗓️</span>Schedule
        </button>
        <button class="nav-item" id="nav-doc-profile">
          <span class="nav-icon">👤</span>Profile
        </button>
      </div>
    </div>
  `;

  root.querySelector("#back-btn").addEventListener("click", () => back());
  root.querySelector("#nav-queue").addEventListener("click", () => navigate("/doctor/queue"));
  root.querySelector("#nav-doc-profile").addEventListener("click", () => navigate("/profile"));

  loadSchedule(root, doctorId);
}

async function loadSchedule(root, doctorId) {
  const contentEl = root.querySelector("#schedule-content");

  try {
    const [schedRes, breakRes] = await Promise.all([
      get(`/doctors/${doctorId}/schedules`),
      get(`/doctors/${doctorId}/breaks`),
    ]);

    const schedules = (schedRes.data || []).sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    const breaks = breakRes.data || [];

    let html = "";

    // Weekly hours
    html += `<h3 class="mb-12" style="font-size:0.9rem;">Weekly Hours</h3>`;

    if (schedules.length === 0) {
      html += `
        <div class="card mb-20">
          <div style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:8px 0;">
            No schedule configured. Contact your admin.
          </div>
        </div>
      `;
    } else {
      html += schedules.map((s) => `
        <div class="card mb-8">
          <div class="schedule-row">
            <span class="badge badge-primary">${DAY_NAMES[s.dayOfWeek]}</span>
            <span class="time">${s.startTime} – ${s.endTime}</span>
            <span class="duration">${s.slotDurationMinutes}min</span>
          </div>
        </div>
      `).join("");
    }

    // Breaks
    html += `<h3 class="mb-12 mt-24" style="font-size:0.9rem;">Upcoming Breaks</h3>`;

    if (breaks.length === 0) {
      html += `
        <div class="card">
          <div style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:8px 0;">
            No breaks scheduled.
          </div>
        </div>
      `;
    } else {
      html += breaks.map((b) => `
        <div class="card mb-8">
          <div class="flex-between">
            <div>
              <div style="font-size:0.88rem; font-weight:550;">${b.startDate} → ${b.endDate}</div>
              ${b.reason ? `<div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">${b.reason}</div>` : ""}
            </div>
            <span class="badge badge-warning">Break</span>
          </div>
        </div>
      `).join("");
    }

    contentEl.innerHTML = html;
  } catch (err) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">⚠️</div>
        <h3>Failed to load schedule</h3>
        <p>${err.message}</p>
      </div>
    `;
  }
}

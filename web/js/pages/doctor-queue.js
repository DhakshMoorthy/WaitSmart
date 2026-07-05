import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

import { get, post } from "../api.js";
import { getAuth } from "../auth.js";
import { navigate } from "../router.js";
import { connectSocket, getSocket, subscribeToQueue, SOCKET_EVENTS } from "../socket.js";

export function renderDoctorQueue(root) {
  const { user } = getAuth();
  const doctorId = user?.doctorId;
  const today = dayjs().format("YYYY-MM-DD");

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
        <h2>Today's Queue</h2>
        <p class="subtitle">${dayjs().format("dddd, MMM D, YYYY")}</p>
      </div>
      <div class="page-content" id="queue-content">
        <div class="loading"><div class="spinner"></div><span class="loading-text">Loading queue...</span></div>
      </div>
      <div class="bottom-nav">
        <button class="nav-item active">
          <span class="nav-icon">📋</span>Queue
        </button>
        <button class="nav-item" id="nav-schedule">
          <span class="nav-icon">🗓️</span>Schedule
        </button>
        <button class="nav-item" id="nav-doc-profile">
          <span class="nav-icon">👤</span>Profile
        </button>
      </div>
    </div>
  `;

  root.querySelector("#nav-schedule").addEventListener("click", () => navigate("/doctor/schedule"));
  root.querySelector("#nav-doc-profile").addEventListener("click", () => navigate("/profile"));

  connectSocket();
  subscribeToQueue(doctorId);

  const socket = getSocket();
  socket.on(SOCKET_EVENTS.QUEUE_UPDATE, () => loadQueue());
  socket.on(SOCKET_EVENTS.BOOKING_CREATED, () => loadQueue());

  async function loadQueue() {
    const contentEl = root.querySelector("#queue-content");
    if (!contentEl) return;

    try {
      const data = await get("/avail", { doctorId, date: today });
      const slots = data.data?.slots || [];
      const patients = slots
        .filter((s) => s.status === "booked" && s.appointment)
        .map((s) => ({
          id: s.appointment.id,
          tokenNumber: s.appointment.tokenNumber,
          patientName: s.appointment.patientName,
          symptoms: s.appointment.symptoms,
          status: s.appointment.status,
          slotTime: s.slotTime,
        }))
        .sort((a, b) => a.tokenNumber - b.tokenNumber);

      const waiting = patients.filter((p) => p.status === "waiting");
      const current = patients.find((p) => p.status === "in-cabin");
      const done = patients.filter((p) => p.status === "done");

      let html = "";

      // Stats
      html += `
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-num">${waiting.length}</div>
            <div class="stat-label">Waiting</div>
          </div>
          <div class="stat-card">
            <div class="stat-num">${done.length}</div>
            <div class="stat-label">Done</div>
          </div>
          <div class="stat-card">
            <div class="stat-num">${patients.length}</div>
            <div class="stat-label">Total</div>
          </div>
        </div>
      `;

      // Current patient
      if (current) {
        html += `
          <div class="current-patient-card">
            <div class="label">Now Seeing</div>
            <div class="patient-info">
              <div class="token">#${current.tokenNumber}</div>
              <div>
                <div style="font-weight:600;">${current.patientName}</div>
                ${current.symptoms ? `<div style="font-size:0.82rem; color:var(--text-muted); margin-top:2px;">${current.symptoms}</div>` : ""}
              </div>
            </div>
            <div class="actions">
              <button class="btn btn-primary btn-sm" data-action="done">Done</button>
              <button class="btn btn-outline btn-sm" data-action="skip">Skip</button>
              <button class="btn btn-ghost btn-sm" data-action="no-show">No Show</button>
            </div>
          </div>
        `;
      } else if (waiting.length > 0) {
        html += `
          <button class="btn btn-primary btn-lg mb-20" id="next-btn" style="background:var(--success);">
            Call Next Patient
          </button>
        `;
      }

      // Waiting list
      if (waiting.length > 0) {
        html += `<h3 class="mb-12" style="font-size:0.9rem;">Waiting (${waiting.length})</h3>`;
        html += waiting.map((p) => `
          <div class="card mb-8">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="background:var(--accent-light); padding:6px 10px; border-radius:var(--radius-sm); font-weight:700; font-size:0.8rem; color:var(--accent-dark);">
                #${p.tokenNumber}
              </div>
              <div style="flex:1;">
                <div style="font-weight:550; font-size:0.9rem;">${p.patientName}</div>
                <div style="font-size:0.78rem; color:var(--text-muted);">
                  ${dayjs.utc(p.slotTime).format("h:mm A")}${p.symptoms ? ` · ${p.symptoms}` : ""}
                </div>
              </div>
              <span class="badge badge-primary">Waiting</span>
            </div>
          </div>
        `).join("");
      } else if (!current) {
        html += `
          <div class="empty-state">
            <div class="icon">✨</div>
            <h3>No patients waiting</h3>
            <p>Queue is clear for now</p>
          </div>
        `;
      }

      contentEl.innerHTML = html;

      // Bind action buttons
      contentEl.querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => handleAction(btn.dataset.action, btn));
      });

      const nextBtn = contentEl.querySelector("#next-btn");
      if (nextBtn) {
        nextBtn.addEventListener("click", () => handleAction("next", nextBtn));
      }
    } catch (err) {
      contentEl.innerHTML = `
        <div class="empty-state">
          <div class="icon">⚠️</div>
          <h3>Failed to load queue</h3>
          <p>${err.message}</p>
        </div>
      `;
    }
  }

  async function handleAction(action, btn) {
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "...";

    try {
      await post(`/admin/${action}`, { doctorId, date: today });
      await loadQueue();
    } catch (err) {
      alert(err.message || `Failed to ${action}`);
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }

  loadQueue();
}

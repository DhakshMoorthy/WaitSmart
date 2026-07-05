import {
  getAllDoctors,
  getClinics,
  subscribeToDoctorDay,
  nextPatient,
  skipPatient,
  markNoShow,
  resetQueue,
} from "../db.js";
import { replace } from "../router.js";
import { renderShell, clearAdminAuth, escapeHtml } from "../layout.js";
import { getDateOptions, formatDisplayDate, todayStr, formatTime12 } from "../utils/dates.js";

export function renderAdminDashboard(root) {
  let doctorId = "";
  let date = todayStr();
  let unsub = null;

  renderShell(root, {
    showHeader: true,
    showAdminLink: false,
    adminMode: true,
    content: `
      <div class="admin-top">
        <div>
          <p class="eyebrow">ADMIN DASHBOARD</p>
          <h1 class="page-title">Slot control</h1>
        </div>
        <button class="btn btn-ghost btn-sm" id="logout-btn">↪ Logout</button>
      </div>
      <div class="page-content admin-content">
        <div class="admin-select-card">
          <div class="form-group">
            <label class="field-label">DOCTOR</label>
            <select id="doctor-select" class="select"></select>
          </div>
          <div class="form-group">
            <label class="field-label">DATE</label>
            <select id="date-select" class="select"></select>
          </div>
          <div class="sync-status"><span class="live-dot"></span> Live sync active</div>
        </div>
        <div id="dashboard"><div class="loading"><div class="spinner"></div></div></div>
      </div>
    `,
  });

  root.querySelector("#logout-btn").addEventListener("click", () => {
    if (unsub) unsub();
    clearAdminAuth();
    replace("/admin");
  });

  const doctorSelect = root.querySelector("#doctor-select");
  const dateSelect = root.querySelector("#date-select");
  const dashboard = root.querySelector("#dashboard");

  Promise.all([getAllDoctors(), getClinics()]).then(([doctors, clinics]) => {
    const clinicMap = Object.fromEntries(clinics.map((c) => [c.id, c.branch]));
    doctorSelect.innerHTML = doctors
      .map(
        (d) =>
          `<option value="${d.id}">${escapeHtml(d.name)} — ${escapeHtml(d.specialization)} (${escapeHtml(clinicMap[d.clinic_id] || "")})</option>`,
      )
      .join("");

    dateSelect.innerHTML = getDateOptions(7)
      .map((d) => `<option value="${d.value}">${escapeHtml(d.label)}</option>`)
      .join("");

    doctorId = doctors[0]?.id || "";
    bindSubscription();
  });

  doctorSelect.addEventListener("change", () => {
    doctorId = doctorSelect.value;
    bindSubscription();
  });

  dateSelect.addEventListener("change", () => {
    date = dateSelect.value;
    bindSubscription();
  });

  function bindSubscription() {
    if (unsub) unsub();
    if (!doctorId) return;
    unsub = subscribeToDoctorDay(doctorId, date, ({ queue, appointments, stats, duration }) => {
      renderDashboard(dashboard, queue, appointments, stats, duration);
    });
  }

  function renderDashboard(el, queue, appointments, stats, duration) {
    const current = stats.nowServing;
    const inCabin = stats.inCabin;

    el.innerHTML = `
      <div class="stats-row-admin">
        <div class="stat-box">
          <div class="stat-label">NOW SERVING</div>
          <div class="stat-value">${current ?? "—"}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">BOOKED SLOTS</div>
          <div class="stat-value">${stats.booked}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">WAITING</div>
          <div class="stat-value">${stats.waiting}</div>
        </div>
      </div>

      <div class="cabin-card">
        <div class="cabin-header">
          <span>Currently in Cabin</span>
          <span class="pulse-icon blue">〰</span>
        </div>
        ${
          inCabin
            ? `
          <div class="cabin-patient">
            <div class="cabin-token">#${inCabin.token}</div>
            <div>
              <div class="cabin-name">${escapeHtml(inCabin.name)}</div>
              <div class="cabin-slot">${formatTime12(inCabin.slot_time)} · Slot #${inCabin.slot_index}</div>
              ${inCabin.notes ? `<div class="cabin-notes">${escapeHtml(inCabin.notes)}</div>` : ""}
            </div>
          </div>`
            : `<p class="cabin-empty">No slot active. Press <strong>Next</strong> to begin the next booked slot.</p>`
        }

        <div class="admin-actions">
          <button class="btn btn-primary admin-action-btn" id="next-btn">
            <span>→</span> Next
          </button>
          <button class="btn btn-skip admin-action-btn" id="skip-btn">
            <span>⏭</span> Skip
          </button>
          <button class="btn btn-noshow admin-action-btn" id="noshow-btn">
            <span>✕</span> No Show
          </button>
        </div>

        <button class="reset-link" id="reset-btn">↻ Reset queue (admin)</button>
      </div>

      <div class="bookings-section">
        <div class="section-head">
          <h2>Bookings — ${formatDisplayDate(date).split("(")[0].trim()}</h2>
          <span class="count-badge">${stats.booked} booked</span>
        </div>
        <div class="bookings-list">
          ${
            appointments.filter((a) => a.status !== "cancelled").length === 0
              ? `<div class="empty-bookings"><div class="empty-icon">📅</div><p>No bookings yet for this doctor.</p></div>`
              : appointments
                  .filter((a) => a.status !== "cancelled")
                  .map(
                    (a) => `
              <div class="booking-row status-${a.status}">
                <div class="booking-time">${formatTime12(a.slot_time)}</div>
                <div class="booking-info">
                  <div class="booking-name">${escapeHtml(a.name)}</div>
                  <div class="booking-meta">Token #${a.token} · Slot #${a.slot_index}</div>
                </div>
                <span class="status-chip ${a.status}">${a.status.replace("_", " ")}</span>
              </div>`,
                  )
                  .join("")
          }
        </div>
      </div>
    `;

    bindBtn(el.querySelector("#next-btn"), () => nextPatient(doctorId, date));
    bindBtn(el.querySelector("#skip-btn"), () => skipPatient(doctorId, date));
    bindBtn(el.querySelector("#noshow-btn"), () => markNoShow(doctorId, date));
    el.querySelector("#reset-btn")?.addEventListener("click", () => {
      if (confirm("Reset today's queue? This cancels waiting bookings.")) {
        resetQueue(doctorId, date);
      }
    });
  }

  function bindBtn(btn, fn) {
    if (!btn) return;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await fn();
      } catch (err) {
        alert(err.message || "Action failed");
      } finally {
        btn.disabled = false;
      }
    });
  }
}

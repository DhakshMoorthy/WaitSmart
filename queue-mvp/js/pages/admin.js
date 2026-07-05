import { getAllDoctors, getClinics, subscribeToQueue, nextPatient, skipPatient, markNoShow, getDoctorSlotDuration } from "../db.js";
import { replace } from "../router.js";
import { renderShell, clearAdminAuth } from "../layout.js";

export function renderAdminDashboard(root) {
  let selectedDoctorId = null;
  let unsub = null;

  renderShell(root, {
    showBack: true,
    title: "Doctor Dashboard",
    subtitle: "Manage live queue",
    footer: false,
    content: `
      <div class="page-content">
        <div class="form-group">
          <label for="doctor-select">Select Doctor</label>
          <select id="doctor-select" class="select">
            <option value="">Loading doctors...</option>
          </select>
        </div>
        <div id="dashboard">
          <div class="empty-state"><p>Select a doctor to view queue</p></div>
        </div>
        <button class="btn btn-ghost btn-block mt-20" id="logout-btn">Sign out</button>
      </div>
    `,
  });

  root.querySelector("#logout-btn").addEventListener("click", () => {
    if (unsub) unsub();
    clearAdminAuth();
    import("./admin-login.js").then((m) => m.renderAdminLogin(root));
  });

  const selectEl = root.querySelector("#doctor-select");
  const dashboardEl = root.querySelector("#dashboard");

  Promise.all([getAllDoctors(), getClinics()]).then(([doctors, clinics]) => {
    const clinicMap = Object.fromEntries(clinics.map((c) => [c.id, c.branch || c.name]));

    selectEl.innerHTML =
      `<option value="">— Choose a doctor —</option>` +
      doctors
        .map(
          (d) =>
            `<option value="${d.id}">${d.name} (${clinicMap[d.clinic_id] || "Branch"})</option>`,
        )
        .join("");

    if (doctors.length === 1) {
      selectEl.value = doctors[0].id;
      selectEl.dispatchEvent(new Event("change"));
    }
  });

  selectEl.addEventListener("change", () => {
    if (unsub) unsub();
    selectedDoctorId = selectEl.value;

    if (!selectedDoctorId) {
      dashboardEl.innerHTML = `<div class="empty-state"><p>Select a doctor to view queue</p></div>`;
      return;
    }

    unsub = subscribeToQueue(selectedDoctorId, ({ queue, waiting }) => {
      renderDashboard(dashboardEl, queue, waiting || [], selectedDoctorId);
    });
  });

  async function renderDashboard(el, queue, waiting, doctorId) {
    const currentToken = queue?.current_token ?? 0;
    const lastToken = queue?.last_token ?? 0;
    const slotMins = await getDoctorSlotDuration(doctorId);

    el.innerHTML = `
      <div class="serving-card">
        <div class="serving-label">Now Serving Token</div>
        <div class="serving-number">${currentToken > 0 ? currentToken : "—"}</div>
        <div class="serving-meta">${waiting.length} waiting · ${lastToken} total issued · ${slotMins} min/slot</div>
      </div>

      <div class="action-row">
        <button class="btn btn-primary btn-block" id="next-btn">Next Patient</button>
      </div>
      <div class="action-row two-col">
        <button class="btn btn-outline" id="skip-btn">Skip Patient</button>
        <button class="btn btn-ghost" id="noshow-btn">Mark No Show</button>
      </div>

      <h3 class="section-title">Waiting Patients (${waiting.length})</h3>
      <div id="waiting-list">
        ${waiting.length === 0
          ? `<div class="empty-queue">No patients waiting</div>`
          : waiting
              .map(
                (p) => `
          <div class="wait-card ${p.token === currentToken + 1 ? "next-up" : ""}">
            <div class="wait-token">#${p.token}</div>
            <div class="wait-info">
              <div class="wait-name">${escapeHtml(p.name)}</div>
              ${p.notes ? `<div class="wait-notes">${escapeHtml(p.notes)}</div>` : ""}
            </div>
            ${p.token === currentToken + 1 ? `<span class="badge badge-next">Up next</span>` : ""}
          </div>
        `,
              )
              .join("")}
      </div>
    `;

    bindAction(el.querySelector("#next-btn"), () => nextPatient(doctorId));
    bindAction(el.querySelector("#skip-btn"), () => skipPatient(doctorId));
    bindAction(el.querySelector("#noshow-btn"), () => markNoShow(doctorId));
  }

  async function bindAction(btn, actionFn) {
    if (!btn) return;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await actionFn();
      } catch (err) {
        alert(err.message || "Action failed");
      } finally {
        btn.disabled = false;
      }
    });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

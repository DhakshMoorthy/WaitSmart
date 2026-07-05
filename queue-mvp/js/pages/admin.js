import {
  getAllDoctors,
  getClinics,
  subscribeToQueue,
  nextPatient,
  skipPatient,
  markNoShow,
} from "../db.js";
import { navigate, back } from "../router.js";

export function renderAdmin(root) {
  let selectedDoctorId = null;
  let unsub = null;

  root.innerHTML = `
    <div class="page admin-page">
      <div class="page-header">
        <button class="back-btn" id="back-btn">←</button>
        <div>
          <h2>Doctor Dashboard</h2>
          <p class="subtitle">Manage live queue</p>
        </div>
      </div>
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
      </div>
    </div>
  `;

  root.querySelector("#back-btn").addEventListener("click", () => {
    if (unsub) unsub();
    back();
  });

  const selectEl = root.querySelector("#doctor-select");
  const dashboardEl = root.querySelector("#dashboard");

  Promise.all([getAllDoctors(), getClinics()]).then(([doctors, clinics]) => {
    const clinicMap = Object.fromEntries(clinics.map((c) => [c.id, c.name]));

    selectEl.innerHTML =
      `<option value="">— Choose a doctor —</option>` +
      doctors
        .map(
          (d) =>
            `<option value="${d.id}">${d.name} (${clinicMap[d.clinic_id] || "Clinic"})</option>`,
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

  function renderDashboard(el, queue, waiting, doctorId) {
    const currentToken = queue?.current_token ?? 0;
    const lastToken = queue?.last_token ?? 0;

    el.innerHTML = `
      <div class="serving-card">
        <div class="serving-label">Now Serving Token</div>
        <div class="serving-number">${currentToken > 0 ? currentToken : "—"}</div>
        <div class="serving-meta">${waiting.length} waiting · ${lastToken} total issued</div>
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
              <div class="wait-name">${p.name}</div>
              ${p.notes ? `<div class="wait-notes">${p.notes}</div>` : ""}
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

  async function bindAction(btn, action) {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await action();
      } catch (err) {
        alert(err.message || "Action failed");
      } finally {
        btn.disabled = false;
      }
    });
  }
}

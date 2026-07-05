import { get } from "../api.js";
import { navigate, back } from "../router.js";

export function renderClinics(root) {
  root.innerHTML = `
    <div class="page">
      <div class="page-header">
        <button class="back-btn" id="back-btn">← Back</button>
        <h2>Select Clinic</h2>
        <p class="subtitle" id="clinic-count"></p>
      </div>
      <div class="page-content" id="clinic-list">
        <div class="loading"><div class="spinner"></div><span class="loading-text">Loading clinics...</span></div>
      </div>
    </div>
  `;

  root.querySelector("#back-btn").addEventListener("click", () => back());

  loadClinics(root);
}

async function loadClinics(root) {
  const listEl = root.querySelector("#clinic-list");
  const countEl = root.querySelector("#clinic-count");

  try {
    const data = await get("/clinics");
    const clinics = data.data || [];

    countEl.textContent = `${clinics.length} clinic${clinics.length !== 1 ? "s" : ""} available`;

    if (clinics.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="icon">🏥</div>
          <h3>No clinics found</h3>
          <p>No clinics available in your area right now.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = clinics.map((clinic) => `
      <div class="card clickable" data-id="${clinic.id}" data-name="${clinic.name}">
        <div style="font-weight:600; color:var(--text-primary);">${clinic.name}</div>
        <div style="font-size:0.82rem; color:var(--text-muted); margin-top:3px;">${clinic.address}</div>
        ${clinic.hours ? `<div style="font-size:0.78rem; color:var(--accent); margin-top:6px;">🕐 ${clinic.hours}</div>` : ""}
      </div>
    `).join("");

    listEl.querySelectorAll(".card.clickable").forEach((card) => {
      card.addEventListener("click", () => {
        navigate("/doctors", { clinicId: card.dataset.id, clinicName: card.dataset.name });
      });
    });
  } catch (err) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">⚠️</div>
        <h3>Failed to load</h3>
        <p>${err.message}</p>
      </div>
    `;
  }
}

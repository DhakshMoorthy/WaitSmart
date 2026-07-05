import { get } from "../api.js";
import { navigate, back, getParams } from "../router.js";

export function renderDoctors(root) {
  const { clinicId, clinicName } = getParams();

  root.innerHTML = `
    <div class="page">
      <div class="page-header">
        <button class="back-btn" id="back-btn">← Back</button>
        <h2>Choose Doctor</h2>
        <p class="subtitle">${clinicName || ""}</p>
      </div>
      <div class="page-content" id="doctor-list">
        <div class="loading"><div class="spinner"></div><span class="loading-text">Loading doctors...</span></div>
      </div>
    </div>
  `;

  root.querySelector("#back-btn").addEventListener("click", () => back());

  loadDoctors(root, clinicId, clinicName);
}

async function loadDoctors(root, clinicId, clinicName) {
  const listEl = root.querySelector("#doctor-list");

  try {
    const data = await get("/doctors", { clinicId });
    const doctors = data.data || [];

    if (doctors.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="icon">👨‍⚕️</div>
          <h3>No doctors available</h3>
          <p>No doctors are registered at this clinic yet.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = doctors.map((doc) => `
      <div class="card clickable" data-id="${doc.id}" data-name="${doc.name}">
        <div class="doctor-row">
          <div class="avatar">${doc.name.charAt(0).toUpperCase()}</div>
          <div class="doctor-info">
            <div class="name">${doc.name}</div>
            <div class="spec">${doc.specialization}</div>
            ${doc.qualification ? `<div class="qual">${doc.qualification}</div>` : ""}
          </div>
        </div>
        ${doc.queueStatus ? `
          <div style="display:flex; gap:8px; margin-top:12px; padding-top:12px; border-top:1px solid var(--border-light);">
            <span class="badge badge-success">Serving #${doc.queueStatus.nowServing || "—"}</span>
            <span class="badge ${doc.queueStatus.waiting > 5 ? "badge-warning" : "badge-neutral"}">${doc.queueStatus.waiting} waiting</span>
          </div>
        ` : ""}
      </div>
    `).join("");

    listEl.querySelectorAll(".card.clickable").forEach((card) => {
      card.addEventListener("click", () => {
        navigate("/slots", {
          doctorId: card.dataset.id,
          doctorName: card.dataset.name,
          clinicId,
        });
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

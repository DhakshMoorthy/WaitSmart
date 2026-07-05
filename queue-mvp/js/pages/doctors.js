import { getDoctors, getQueue } from "../db.js";
import { navigate, back, getParams } from "../router.js";

export function renderDoctors(root) {
  const { clinicId, clinicName } = getParams();

  root.innerHTML = `
    <div class="page">
      <div class="page-header">
        <button class="back-btn" id="back-btn">←</button>
        <div>
          <h2>Choose a doctor</h2>
          <p class="subtitle">${clinicName || ""}</p>
        </div>
      </div>
      <div class="page-content" id="doctor-list">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  root.querySelector("#back-btn").addEventListener("click", () => back());
  loadDoctors(root, clinicId);
}

async function loadDoctors(root, clinicId) {
  const listEl = root.querySelector("#doctor-list");

  try {
    const doctors = await getDoctors(clinicId);

    if (doctors.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><div class="icon">👨‍⚕️</div><h3>No doctors available</h3></div>`;
      return;
    }

    const queueData = await Promise.all(doctors.map((d) => getQueue(d.id)));

    listEl.innerHTML = doctors
      .map((doc, i) => {
        const q = queueData[i];
        const waiting = Math.max(0, q.last_token - q.current_token);
        return `
      <div class="card doctor-card clickable" data-id="${doc.id}" data-name="${doc.name}">
        <div class="doctor-row">
          <div class="avatar">${doc.name.replace("Dr. ", "").charAt(0)}</div>
          <div class="doctor-info">
            <div class="name">${doc.name}</div>
            <div class="spec">${doc.specialization || "General"}</div>
          </div>
        </div>
        <div class="doctor-stats">
          <span class="badge badge-serving">Serving #${q.current_token || "—"}</span>
          <span class="badge ${waiting > 3 ? "badge-warning" : "badge-neutral"}">${waiting} waiting</span>
        </div>
      </div>
    `;
      })
      .join("");

    listEl.querySelectorAll(".doctor-card").forEach((card) => {
      card.addEventListener("click", () => {
        navigate("/book", {
          doctorId: card.dataset.id,
          doctorName: card.dataset.name,
          clinicId,
        });
      });
    });
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><h3>Failed to load</h3><p>${err.message}</p></div>`;
  }
}

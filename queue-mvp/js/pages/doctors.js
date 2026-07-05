import { getDoctors, getQueue } from "../db.js";
import { navigate, getParams } from "../router.js";
import { renderShell } from "../layout.js";

export function renderDoctors(root) {
  const { clinicId, clinicName } = getParams();

  renderShell(root, {
    showBack: true,
    title: "Choose a doctor",
    subtitle: clinicName || "",
    content: `<div class="page-content" id="doctor-list"><div class="loading"><div class="spinner"></div></div></div>`,
  });

  loadDoctors(root, clinicId);
}

async function loadDoctors(root, clinicId) {
  const listEl = root.querySelector("#doctor-list");

  try {
    const doctors = await getDoctors(clinicId);

    if (doctors.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="icon">👨‍⚕️</div>
          <h3>No doctors available</h3>
          <p>No doctors are registered at this branch yet.</p>
        </div>`;
      return;
    }

    const queueData = await Promise.all(doctors.map((d) => getQueue(d.id)));

    listEl.innerHTML = doctors
      .map((doc, i) => {
        const q = queueData[i];
        const waiting = Math.max(0, q.last_token - q.current_token);
        const serving = q.current_token > 0 ? `#${q.current_token}` : "—";
        const slotMin = doc.slot_duration_minutes || 30;
        return `
      <div class="card doctor-card clickable" data-id="${doc.id}" data-name="${doc.name}">
        <div class="doctor-row">
          <div class="avatar">${doc.name.replace("Dr. ", "").charAt(0)}</div>
          <div class="doctor-info">
            <div class="name">${doc.name}</div>
            <div class="spec">${doc.specialization || "General Medicine"}</div>
            <div class="slot-info">${slotMin} min slots · 9 AM–2 PM, 4 PM–6 PM</div>
          </div>
        </div>
        <div class="doctor-stats">
          <span class="badge badge-serving">Serving ${serving}</span>
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

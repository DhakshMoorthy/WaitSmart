import { getDoctors, getQueue, subscribeToDoctorDay, getClinic } from "../db.js";
import { navigate, getParams } from "../router.js";
import { renderShell, escapeHtml } from "../layout.js";
import { todayStr } from "../utils/dates.js";

export function renderDoctors(root) {
  const { clinicId, clinicName } = getParams();
  const date = todayStr();

  renderShell(root, {
    showBack: true,
    showAdminLink: true,
    content: `
      <div id="clinic-hero" class="clinic-hero-wrap"><div class="loading"><div class="spinner"></div></div></div>
      <div class="page-content">
        <div class="section-head">
          <h2>Available doctors</h2>
          <span class="count-badge" id="doc-count">…</span>
        </div>
        <div id="doctor-list"><div class="loading"><div class="spinner"></div></div></div>
      </div>
    `,
  });

  getClinic(clinicId).then((clinic) => {
    const hero = root.querySelector("#clinic-hero");
    hero.innerHTML = `
      <div class="clinic-hero" style="background-image:url('${clinic?.image_url || ""}')">
        <div class="clinic-hero-overlay">
          <span class="clinic-tag">CLINIC</span>
          <span class="clinic-hero-title">${escapeHtml(clinicName || clinic?.name || "")}</span>
        </div>
      </div>
      <div class="clinic-hours-bar">🕐 ${escapeHtml(clinic?.hours || "9:00 AM – 2:00 PM • 4:00 PM – 6:00 PM")}</div>
    `;
  });

  loadDoctors(root, clinicId, date);
}

async function loadDoctors(root, clinicId, date) {
  const listEl = root.querySelector("#doctor-list");
  const countEl = root.querySelector("#doc-count");

  try {
    const doctors = await getDoctors(clinicId);
    countEl.textContent = `${doctors.length} doctor${doctors.length !== 1 ? "s" : ""}`;

    if (doctors.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">👨‍⚕️</div><h3>No doctors available</h3><p>No doctors registered at this branch yet.</p></div>`;
      return;
    }

    const renderList = async () => {
      const cards = await Promise.all(
        doctors.map(async (doc) => {
          const q = await getQueue(doc.id, date);
          const waiting = Math.max(0, (q.last_token || 0) - (q.current_token || 0));
          const serving = q.current_token > 0 ? `#${q.current_token}` : "—";
          return `
        <div class="doctor-card clickable" data-id="${doc.id}" data-name="${escapeHtml(doc.name)}">
          <img class="doctor-photo" src="${doc.photo_url || ""}" alt="${escapeHtml(doc.name)}" />
          <div class="doctor-body">
            <div class="doctor-name">${escapeHtml(doc.name)}</div>
            <div class="doctor-spec">${escapeHtml(doc.specialization)}</div>
            <div class="doctor-exp">🏅 ${doc.experience_years || 0} yrs exp</div>
            <div class="doctor-badges">
              <span class="badge badge-blue">NOW SERVING ${serving}</span>
              <span class="badge badge-gray">${waiting} WAITING</span>
            </div>
          </div>
          <button class="clinic-go-btn">→</button>
        </div>`;
        }),
      );
      listEl.innerHTML = cards.join("");
      listEl.querySelectorAll(".doctor-card").forEach((card) => {
        card.addEventListener("click", () => {
          navigate("/book", {
            doctorId: card.dataset.id,
            doctorName: card.dataset.name,
            clinicId,
          });
        });
      });
    };

    await renderList();

    const unsubs = doctors.map((doc) =>
      subscribeToDoctorDay(doc.id, date, renderList),
    );

    root._doctorUnsubs = unsubs;
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><p>${escapeHtml(err.message)}</p></div>`;
  }
}

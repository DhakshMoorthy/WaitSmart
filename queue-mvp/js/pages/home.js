import { getClinics } from "../db.js";
import { navigate } from "../router.js";
import { renderShell, HOSPITAL_NAME } from "../layout.js";

export function renderHome(root) {
  renderShell(root, {
    content: `
      <div class="hero">
        <div class="hero-badge">Skip the wait</div>
        <h1>Book a token,<br>track your turn live.</h1>
        <p class="hero-sub">Real-time queue updates from ${HOSPITAL_NAME}. No login, no hassle — just walk in when it's your turn.</p>
        <div class="hero-pills">
          <span class="pill">9 AM – 2 PM</span>
          <span class="pill">4 PM – 6 PM</span>
        </div>
      </div>

      <div class="page-content">
        <div class="section-head">
          <h2>Choose a clinic</h2>
          <p class="subtitle" id="clinic-count">Loading...</p>
        </div>
        <div id="clinic-list">
          <div class="loading"><div class="spinner"></div></div>
        </div>
      </div>
    `,
  });

  loadClinics(root);
}

async function loadClinics(root) {
  const listEl = root.querySelector("#clinic-list");
  const countEl = root.querySelector("#clinic-count");

  try {
    const clinics = await getClinics();
    countEl.textContent = `${clinics.length} available`;

    if (clinics.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><div class="icon">🏥</div><h3>No clinics found</h3></div>`;
      return;
    }

    listEl.innerHTML = clinics
      .map(
        (c) => `
      <div class="card clinic-card clickable" data-id="${c.id}" data-name="${c.name}">
        <div class="clinic-icon">🏥</div>
        <div class="clinic-info">
          <div class="clinic-name">${c.name}</div>
          ${c.address ? `<div class="clinic-meta">${c.address}</div>` : ""}
          ${c.hours ? `<div class="clinic-hours">🕐 ${c.hours}</div>` : ""}
        </div>
        <div class="card-arrow">›</div>
      </div>
    `,
      )
      .join("");

    listEl.querySelectorAll(".clinic-card").forEach((card) => {
      card.addEventListener("click", () => {
        navigate("/doctors", { clinicId: card.dataset.id, clinicName: card.dataset.name });
      });
    });
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><h3>Failed to load</h3><p>${err.message}</p></div>`;
  }
}

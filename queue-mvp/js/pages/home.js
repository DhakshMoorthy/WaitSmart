import {
  getClinics,
  getAppointment,
  getDoctor,
} from "../db.js";
import { get } from "../api.js";
import { navigate } from "../router.js";
import { renderShell, escapeHtml, HOSPITAL_NAME } from "../layout.js";
import { getActiveTokenIds } from "../utils/active-tokens.js";

export function renderHome(root) {
  renderShell(root, {
    footer: true,
    content: `
      <div class="hero-block">
        <span class="hero-badge">Skip the wait</span>
        <h1 class="hero-title">Book a token,<br>track your turn live.</h1>
        <p class="hero-desc">Real-time queue updates from ${HOSPITAL_NAME}. Book a slot and walk in when it's your turn.</p>
        <div class="hero-pills">
          <span class="pill">9 AM – 2 PM</span>
          <span class="pill">4 PM – 6 PM</span>
        </div>
      </div>
      <div class="page-content">
        <div id="active-section"></div>
        <div class="section-head">
          <h2>Choose a clinic</h2>
          <span class="count-badge" id="clinic-count">…</span>
        </div>
        <div id="clinic-list"><div class="loading"><div class="spinner"></div></div></div>
      </div>
    `,
  });

  loadActiveTokens(root);
  loadClinics(root);
}

async function loadActiveTokens(root) {
  const section = root.querySelector("#active-section");
  let ids = getActiveTokenIds();

  try {
    const res = await get("/patients/history");
    const historyIds = (res.data || [])
      .filter((h) => !["done", "cancelled", "skipped", "no-show"].includes(h.status))
      .map((h) => h.id);
    ids = [...new Set([...ids, ...historyIds])];
  } catch {
    /* history unavailable */
  }

  if (ids.length === 0) {
    section.innerHTML = "";
    return;
  }

  const cards = await Promise.all(
    ids.map(async (id) => {
      const appt = await getAppointment(id);
      if (!appt || ["done", "cancelled", "skipped", "no_show"].includes(appt.status)) return null;
      const doctor = await getDoctor(appt.doctor_id);
      return { appt, doctor };
    }),
  );

  const valid = cards.filter(Boolean);
  if (valid.length === 0) {
    section.innerHTML = "";
    return;
  }

  section.innerHTML = `
    <div class="section-head"><h2>Your active tokens</h2></div>
    ${valid
      .map(
        ({ appt, doctor }) => `
      <div class="active-token-card clickable" data-id="${appt.id}">
        <div class="token-icon">🎫</div>
        <div class="token-info">
          <div class="token-label">TOKEN</div>
          <div class="token-num">#${appt.token}</div>
          <div class="token-doctor">${escapeHtml(doctor?.name || "Doctor")}</div>
          <div class="token-patient">for ${escapeHtml(appt.name)}</div>
        </div>
      </div>
    `,
      )
      .join("")}
  `;

  section.querySelectorAll(".active-token-card").forEach((card) => {
    card.addEventListener("click", () => navigate("/token", { appointmentId: card.dataset.id }));
  });
}

async function loadClinics(root) {
  const listEl = root.querySelector("#clinic-list");
  const countEl = root.querySelector("#clinic-count");

  try {
    const clinics = await getClinics();
    countEl.textContent = `${clinics.length} available`;

    listEl.innerHTML = clinics
      .map(
        (c) => `
      <div class="clinic-image-card clickable" data-id="${c.id}" data-name="${escapeHtml(c.name)}">
        <div class="clinic-img" style="background-image:url('${c.image_url || ""}')">
          <div class="clinic-img-overlay">
            <span class="clinic-tag">WAITSMART</span>
            <span class="clinic-branch">${escapeHtml(c.branch)}</span>
          </div>
        </div>
        <div class="clinic-card-body">
          <div class="clinic-meta-row">
            <span>📍 ${escapeHtml(c.address)}</span>
          </div>
          <div class="clinic-meta-row">
            <span>🕐 ${escapeHtml(c.hours)}</span>
          </div>
          <button class="clinic-go-btn" aria-label="Select clinic">→</button>
        </div>
      </div>
    `,
      )
      .join("");

    listEl.querySelectorAll(".clinic-image-card").forEach((card) => {
      card.addEventListener("click", () => {
        navigate("/doctors", { clinicId: card.dataset.id, clinicName: card.dataset.name });
      });
    });
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><p>${escapeHtml(err.message)}</p></div>`;
  }
}

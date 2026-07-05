import { subscribeToAppointment, calcWaitMinutes, getDoctor } from "../db.js";
import { replace, navigate, getParams } from "../router.js";
import { renderShell, escapeHtml } from "../layout.js";
import { formatTime12, formatShortDate } from "../utils/dates.js";

export function renderToken(root) {
  const { appointmentId } = getParams();
  let unsub = null;

  renderShell(root, {
    showBack: true,
    content: `<div class="page-content" id="ticket-root"><div class="loading"><div class="spinner"></div></div></div>
      <div class="ticket-footer">
        <button class="btn btn-outline flex-1" id="refresh-btn">↻ Refresh</button>
        <button class="btn btn-outline flex-1" id="home-btn">← Home</button>
      </div>`,
  });

  root.querySelector("#home-btn").addEventListener("click", () => {
    if (unsub) unsub();
    replace("/");
  });

  root.querySelector("#refresh-btn").addEventListener("click", () => {
    /* onSnapshot handles live updates */
  });

  function renderTicket(data) {
    const el = root.querySelector("#ticket-root");
    if (!data?.appointment) {
      el.innerHTML = `<div class="empty-state"><h3>Appointment not found</h3></div>`;
      return;
    }

    const { appointment: appt, queue, duration } = data;
    const current = queue?.current_token ?? 0;
    const waitMin = calcWaitMinutes(appt.token, current, duration || 30);
    const isTurn = appt.token <= current && current > 0 && appt.status === "waiting";
    const isDone = appt.status === "done";

    el.innerHTML = `
      <div class="appointment-banner">
        <span class="pulse-icon">〰</span>
        Your appointment is at <strong>${formatTime12(appt.slot_time)}</strong>
      </div>

      <div class="ticket-card">
        <div class="ticket-top">
          <div>
            <div class="ticket-label">YOUR SLOT</div>
            <div class="ticket-time">${formatTime12(appt.slot_time)}</div>
            <div class="ticket-date">${formatShortDate(appt.date)}</div>
            <div class="ticket-slot-meta">Slot #${appt.slot_index} of ${appt.total_slots}</div>
          </div>
          <div class="live-badge"><span class="live-dot"></span> LIVE</div>
        </div>

        <div class="ticket-patient">For <strong>${escapeHtml(appt.name)}</strong></div>

        <div class="ticket-queue-box">
          <div class="tq-col">
            <div class="tq-label">NOW SERVING</div>
            <div class="tq-value">${current > 0 ? current : "—"}</div>
          </div>
          <div class="tq-col highlight">
            <div class="tq-label">EST. WAIT</div>
            <div class="tq-value">${isTurn ? "Now!" : isDone ? "—" : `${waitMin} min`}</div>
          </div>
        </div>

        <div class="token-badge">Token #${appt.token}</div>

        ${isTurn ? `<div class="alert alert-success">🎉 It's your turn! Please proceed to the doctor's cabin.</div>` : ""}
        ${isDone ? `<div class="alert alert-info">✅ Consultation complete. Thank you!</div>` : ""}
      </div>

      <div id="doctor-card-wrap"></div>

      ${appt.notes ? `
        <div class="notes-block">
          <div class="field-label">YOUR NOTES</div>
          <div class="notes-text">${escapeHtml(appt.notes)}</div>
        </div>
      ` : ""}
    `;

    getDoctor(appt.doctor_id).then((doc) => {
      const wrap = el.querySelector("#doctor-card-wrap");
      if (!doc || !wrap) return;
      wrap.innerHTML = `
        <div class="doctor-mini-card mt-16">
          <img class="doctor-photo-sm" src="${doc.photo_url || ""}" alt="" />
          <div>
            <div class="doctor-name">${escapeHtml(doc.name)}</div>
            <div class="doctor-spec">${escapeHtml(doc.specialization)}</div>
            <div class="doctor-hours-sm">🕐 9:00 AM – 2:00 PM • 4:00 PM – 6:00 PM</div>
          </div>
        </div>`;
    });
  }

  unsub = subscribeToAppointment(appointmentId, renderTicket);
}

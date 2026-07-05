import {
  subscribeToAppointment,
  calcWaitMinutes,
  getDoctor,
  getDoctorSlotDuration,
} from "../db.js";
import { replace, getParams } from "../router.js";
import { renderShell } from "../layout.js";

export function renderToken(root) {
  const { appointmentId, doctorName, doctorId } = getParams();
  let unsub = null;
  let slotMinutes = 30;

  renderShell(root, {
    footer: false,
    content: `
      <div class="page-content token-page">
        <div class="success-icon">✅</div>
        <h2>Token Confirmed!</h2>
        <p class="subtitle" id="doctor-label">${doctorName || ""}</p>

        <div class="token-display">
          <div class="token-label">Your Token Number</div>
          <div class="token-number" id="your-token">—</div>
        </div>

        <div class="live-card">
          <div class="live-header">
            <span class="live-dot"></span>
            Live Queue Status
          </div>
          <div class="live-grid">
            <div class="live-item serving">
              <div class="live-item-label">Now Serving</div>
              <div class="live-item-value" id="now-serving">—</div>
            </div>
            <div class="live-item wait">
              <div class="live-item-label">Est. Wait Time</div>
              <div class="live-item-value" id="wait-time">—</div>
            </div>
          </div>
        </div>

        <div class="alert alert-turn" id="turn-alert" style="display:none;">
          🎉 It's your turn! Please proceed to the doctor's cabin.
        </div>

        <div class="alert alert-done" id="done-alert" style="display:none;">
          ✅ Your consultation is complete. Thank you!
        </div>

        <div class="position-info" id="position-info"></div>

        <button class="btn btn-outline btn-block mt-20" id="home-btn">Back to Home</button>
      </div>
    `,
  });

  root.querySelector("#home-btn").addEventListener("click", () => {
    if (unsub) unsub();
    replace("/");
  });

  if (doctorId) {
    getDoctorSlotDuration(doctorId).then((m) => {
      slotMinutes = m;
    });
  }

  function updateUI({ appointment, queue }) {
    if (!appointment) return;

    const currentToken = queue?.current_token ?? 0;
    const yourToken = appointment.token;
    const waitMinutes = calcWaitMinutes(yourToken, currentToken, slotMinutes);
    const position = Math.max(0, yourToken - currentToken);

    root.querySelector("#your-token").textContent = yourToken;
    root.querySelector("#now-serving").textContent =
      currentToken > 0 ? `#${currentToken}` : "Not started";
    root.querySelector("#wait-time").textContent =
      waitMinutes === 0 ? "Now!" : `${waitMinutes} min`;

    const turnAlert = root.querySelector("#turn-alert");
    const doneAlert = root.querySelector("#done-alert");
    const positionInfo = root.querySelector("#position-info");

    turnAlert.style.display = "none";
    doneAlert.style.display = "none";

    if (appointment.status === "done") {
      doneAlert.style.display = "block";
      positionInfo.textContent = "";
    } else if (yourToken <= currentToken && currentToken > 0) {
      turnAlert.style.display = "block";
      positionInfo.textContent = "";
    } else if (position > 0) {
      positionInfo.innerHTML = `<span class="position-badge">${position} patient${position > 1 ? "s" : ""} ahead · ~${waitMinutes} min wait</span>`;
    } else {
      positionInfo.textContent = "";
    }
  }

  getDoctor(doctorId).then((doc) => {
    if (doc) {
      if (!doctorName) root.querySelector("#doctor-label").textContent = doc.name;
      slotMinutes = doc.slot_duration_minutes || 30;
    }
  });

  unsub = subscribeToAppointment(appointmentId, (data) => {
    if (data) updateUI(data);
  });
}

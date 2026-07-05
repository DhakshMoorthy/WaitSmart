import { bookAppointment, getQueue, calcWaitMinutes, getDoctorSlotDuration, subscribeToQueue } from "../db.js";
import { navigate, getParams } from "../router.js";
import { renderShell } from "../layout.js";

export function renderBook(root) {
  const { doctorId, doctorName } = getParams();
  let unsub = null;

  renderShell(root, {
    showBack: true,
    title: "Get your token",
    subtitle: doctorName || "",
    content: `
      <div class="page-content">
        <form id="book-form" class="book-form">
          <div class="form-group">
            <label for="name">Patient name *</label>
            <input type="text" id="name" placeholder="Enter your full name" required autocomplete="name" />
          </div>
          <div class="form-group">
            <label for="notes">Notes (optional)</label>
            <textarea id="notes" rows="3" placeholder="Symptoms or reason for visit"></textarea>
          </div>
          <div class="queue-preview card" id="queue-preview">
            <div class="preview-row">
              <span>Now serving</span>
              <strong id="preview-serving">—</strong>
            </div>
            <div class="preview-row">
              <span>Patients waiting</span>
              <strong id="preview-waiting">—</strong>
            </div>
            <div class="preview-row">
              <span>Est. wait per patient</span>
              <strong id="preview-slot">30 min</strong>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-lg btn-block" id="submit-btn">
            Get Token
          </button>
        </form>
      </div>
    `,
  });

  getDoctorSlotDuration(doctorId).then((mins) => {
    root.querySelector("#preview-slot").textContent = `${mins} min`;
  });

  function updatePreview(queue) {
    if (!queue) return;
    root.querySelector("#preview-serving").textContent =
      queue.current_token > 0 ? `#${queue.current_token}` : "Not started";
    root.querySelector("#preview-waiting").textContent = Math.max(
      0,
      queue.last_token - queue.current_token,
    );
  }

  getQueue(doctorId).then(updatePreview);
  unsub = subscribeToQueue(doctorId, ({ queue }) => updatePreview(queue));

  root.querySelector("#book-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = root.querySelector("#submit-btn");
    const name = root.querySelector("#name").value.trim();
    const notes = root.querySelector("#notes").value.trim();

    if (!name) return;

    btn.disabled = true;
    btn.textContent = "Booking...";

    try {
      const appointment = await bookAppointment({ name, doctorId, notes });
      const queue = await getQueue(doctorId);
      const slotMins = await getDoctorSlotDuration(doctorId);
      const waitMinutes = calcWaitMinutes(appointment.token, queue.current_token, slotMins);

      if (unsub) unsub();
      navigate("/token", {
        appointmentId: appointment.id,
        doctorId,
        doctorName,
        waitMinutes,
      });
    } catch (err) {
      alert(err.message || "Failed to book token");
      btn.disabled = false;
      btn.textContent = "Get Token";
    }
  });
}

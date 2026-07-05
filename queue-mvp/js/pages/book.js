import { bookAppointment, getQueue, calcWaitMinutes } from "../db.js";
import { navigate, back, getParams } from "../router.js";

export function renderBook(root) {
  const { doctorId, doctorName } = getParams();

  root.innerHTML = `
    <div class="page">
      <div class="page-header">
        <button class="back-btn" id="back-btn">←</button>
        <div>
          <h2>Get your token</h2>
          <p class="subtitle">${doctorName || ""}</p>
        </div>
      </div>
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
          </div>
          <button type="submit" class="btn btn-primary btn-lg btn-block" id="submit-btn">
            Get Token
          </button>
        </form>
      </div>
    </div>
  `;

  root.querySelector("#back-btn").addEventListener("click", () => back());

  getQueue(doctorId).then((q) => {
    root.querySelector("#preview-serving").textContent = q.current_token > 0 ? `#${q.current_token}` : "Not started";
    root.querySelector("#preview-waiting").textContent = Math.max(0, q.last_token - q.current_token);
  });

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
      const waitMinutes = calcWaitMinutes(appointment.token, queue.current_token);

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

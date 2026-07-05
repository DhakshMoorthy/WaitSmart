import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

import { post } from "../api.js";
import { getAuth } from "../auth.js";
import { replace, back, getParams } from "../router.js";

export function renderBookConfirm(root) {
  const { doctorId, doctorName, clinicId, slotId, slotTime, date } = getParams();
  const { user } = getAuth();

  root.innerHTML = `
    <div class="page">
      <div class="page-header">
        <button class="back-btn" id="back-btn">← Back</button>
        <h2>Confirm Booking</h2>
      </div>
      <div class="page-content">
        <div class="card mb-20">
          <h3 style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:10px;">Appointment Details</h3>
          <div class="summary-list">
            <div class="summary-row">
              <span class="label">Doctor</span>
              <span class="value">${doctorName}</span>
            </div>
            <div class="summary-row">
              <span class="label">Date</span>
              <span class="value">${dayjs(date).format("ddd, MMM D, YYYY")}</span>
            </div>
            <div class="summary-row">
              <span class="label">Time</span>
              <span class="value">${dayjs.utc(slotTime).format("h:mm A")}</span>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>Patient Name</label>
          <input class="form-input" id="patient-name" value="${user?.name || ""}" placeholder="Full name">
        </div>

        <div class="form-group">
          <label>Phone Number</label>
          <input class="form-input" id="patient-phone" value="${user?.phone || ""}" placeholder="+91 9876543210">
        </div>

        <div class="form-group">
          <label>Symptoms (optional)</label>
          <textarea class="form-input" id="symptoms" placeholder="Describe your symptoms briefly..."></textarea>
        </div>

        <p class="error-text text-center" id="book-error" style="display:none"></p>

        <button class="btn btn-primary btn-lg" id="confirm-btn">Confirm & Book</button>
      </div>
    </div>
  `;

  root.querySelector("#back-btn").addEventListener("click", () => back());

  root.querySelector("#confirm-btn").addEventListener("click", async () => {
    const patientName = root.querySelector("#patient-name").value.trim();
    const patientPhone = root.querySelector("#patient-phone").value.trim();
    const symptoms = root.querySelector("#symptoms").value.trim();
    const errorEl = root.querySelector("#book-error");
    const btn = root.querySelector("#confirm-btn");

    if (!patientName) {
      errorEl.textContent = "Patient name is required";
      errorEl.style.display = "block";
      return;
    }

    errorEl.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Booking...";

    try {
      const data = await post("/book", {
        clinicId,
        doctorId,
        slotId,
        patientName,
        patientPhone,
        symptoms: symptoms || undefined,
      });

      replace("/ticket", {
        appointmentId: data.data.id,
        tokenNumber: String(data.data.tokenNumber),
        doctorName,
        slotTime,
        date,
        status: data.data.status,
        doctorId,
      });
    } catch (err) {
      errorEl.textContent = err.message || "Booking failed";
      errorEl.style.display = "block";
    } finally {
      btn.disabled = false;
      btn.textContent = "Confirm & Book";
    }
  });
}

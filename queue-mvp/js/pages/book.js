import {
  getDoctor,
  getBookedSlotTimes,
  bookAppointment,
  subscribeToDoctorDay,
} from "../db.js";
import { navigate, getParams } from "../router.js";
import { renderShell, escapeHtml } from "../layout.js";
import { getDateOptions, formatTime12, todayStr } from "../utils/dates.js";
import { getAllSlotTimes, getSlotAvailability } from "../utils/slots.js";
import { addActiveToken } from "../utils/active-tokens.js";

export function renderBook(root) {
  const { doctorId, doctorName, clinicId } = getParams();
  let selectedDate = todayStr();
  let selectedSlot = null;
  let unsub = null;

  renderShell(root, {
    showBack: true,
    content: `<div class="page-content" id="book-root"><div class="loading"><div class="spinner"></div></div></div>`,
  });

  async function render() {
    const container = root.querySelector("#book-root");
    const doctor = await getDoctor(doctorId);
    const dates = getDateOptions(3);
    const booked = await getBookedSlotTimes(doctorId, selectedDate);
    const { morning, evening } = getAllSlotTimes(doctor?.slot_duration_minutes || 30);

    const renderSlots = (times) =>
      times
        .map((t) => {
          const status = getSlotAvailability(selectedDate, t, booked, doctor?.slot_duration_minutes || 30);
          const sel = selectedSlot === t ? " selected" : "";
          const dis = status !== "available" ? " disabled" : "";
          return `<button type="button" class="slot-btn${sel}${dis}" data-time="${t}" ${dis ? "disabled" : ""}>${formatTime12(t)}</button>`;
        })
        .join("");

    container.innerHTML = `
      <div class="doctor-mini-card">
        <img class="doctor-photo-sm" src="${doctor?.photo_url || ""}" alt="" />
        <div>
          <div class="doctor-name">${escapeHtml(doctor?.name || doctorName)}</div>
          <div class="doctor-spec">${escapeHtml(doctor?.specialization || "")}</div>
          <div class="doctor-meta-row">
            <span>👤 ${doctor?.experience_years || 0} yrs</span>
            <span>🕐 ${doctor?.slot_duration_minutes || 30}-min slots</span>
          </div>
        </div>
      </div>

      <div class="form-section">
        <label class="field-label">PICK A DATE</label>
        <div class="date-row" id="date-row">
          ${dates
            .map(
              (d) => `
            <button type="button" class="date-btn${d.value === selectedDate ? " selected" : ""}" data-date="${d.value}">${d.label}</button>
          `,
            )
            .join("")}
        </div>
      </div>

      <div class="form-section">
        <label class="field-label">☀️ MORNING <span class="muted">9:00 AM – 2:00 PM</span></label>
        <div class="slot-grid">${renderSlots(morning)}</div>
      </div>

      <div class="form-section">
        <label class="field-label">🌙 EVENING <span class="muted">4:00 PM – 6:00 PM</span></label>
        <div class="slot-grid">${renderSlots(evening)}</div>
      </div>

      <div class="form-section">
        <label class="field-label" for="patient-name">PATIENT NAME</label>
        <input type="text" id="patient-name" class="input" placeholder="e.g. Anjali Sharma" required autocomplete="name" />
      </div>

      <div class="form-section">
        <label class="field-label" for="notes">NOTES (OPTIONAL)</label>
        <textarea id="notes" class="input" rows="2" placeholder="Symptoms or reason for visit"></textarea>
      </div>

      <button type="button" class="btn btn-primary btn-lg btn-block" id="book-btn" disabled>
        ${selectedSlot ? `Confirm ${formatTime12(selectedSlot)}` : "Select a time slot"}
      </button>
    `;

    container.querySelectorAll(".date-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedDate = btn.dataset.date;
        selectedSlot = null;
        render();
      });
    });

    container.querySelectorAll(".slot-btn:not([disabled])").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedSlot = btn.dataset.time;
        render();
      });
    });

    const bookBtn = container.querySelector("#book-btn");
    if (selectedSlot) {
      bookBtn.disabled = false;
      bookBtn.addEventListener("click", handleBook);
    }
  }

  async function handleBook() {
    const btn = root.querySelector("#book-btn");
    const name = root.querySelector("#patient-name")?.value?.trim();
    const notes = root.querySelector("#notes")?.value?.trim() || "";

    if (!name) {
      alert("Please enter patient name");
      return;
    }
    if (!selectedSlot) return;

    btn.disabled = true;
    btn.textContent = "Booking…";

    try {
      const appt = await bookAppointment({
        name,
        doctorId,
        clinicId,
        date: selectedDate,
        slotTime: selectedSlot,
        notes,
      });
      addActiveToken(appt.id);
      if (unsub) unsub();
      navigate("/token", { appointmentId: appt.id });
    } catch (err) {
      alert(err.message || "Booking failed");
      btn.disabled = false;
      btn.textContent = `Confirm ${formatTime12(selectedSlot)}`;
    }
  }

  render();
  unsub = subscribeToDoctorDay(doctorId, selectedDate, async () => {
    const booked = await getBookedSlotTimes(doctorId, selectedDate);
    root.querySelectorAll(".slot-btn").forEach((btn) => {
      const t = btn.dataset.time;
      const status = getSlotAvailability(selectedDate, t, booked, 30);
      if (status !== "available" && selectedSlot !== t) {
        btn.disabled = true;
        btn.classList.add("disabled");
      }
    });
  });
}

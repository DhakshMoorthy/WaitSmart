import {
  getDoctor,
  getDoctorDaySlots,
  bookAppointment,
  subscribeToDoctorDay,
} from "../db.js";
import { navigate, getParams } from "../router.js";
import { renderShell, escapeHtml } from "../layout.js";
import { getDateOptions, formatTime12, todayStr } from "../utils/dates.js";
import {
  groupServerSlots,
  formatSlotGroupLabel,
  getServerSlotAvailability,
} from "../utils/slots.js";
import { addActiveToken } from "../utils/active-tokens.js";
import { getAuth } from "../auth.js";

export function renderBook(root) {
  const { doctorId, doctorName, clinicId } = getParams();
  let selectedDate = todayStr();
  let selectedSlot = null;
  let unsub = null;
  let daySlots = [];
  let scheduleMessage = null;

  renderShell(root, {
    showBack: true,
    content: `<div class="page-content" id="book-root"><div class="loading"><div class="spinner"></div></div></div>`,
  });

  async function loadDaySlots() {
    const avail = await getDoctorDaySlots(doctorId, selectedDate);
    daySlots = avail.slots;
    scheduleMessage = avail.message;
    return groupServerSlots(daySlots);
  }

  function renderSlotButton(entry) {
    const status = getServerSlotAvailability(selectedDate, entry);
    const sel = selectedSlot === entry.time ? " selected" : "";
    const dis = status !== "available" ? " disabled" : "";
    return `<button type="button" class="slot-btn${sel}${dis}" data-time="${entry.time}" ${dis ? "disabled" : ""}>${formatTime12(entry.time)}</button>`;
  }

  function renderSlotSections(groups) {
    if (!groups.hasSlots) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <h3>No slots available</h3>
          <p>${escapeHtml(scheduleMessage || "This doctor has no schedule for the selected day. Try another date.")}</p>
        </div>
      `;
    }

    const sections = [];

    if (groups.morning.length) {
      sections.push(`
        <div class="form-section">
          <label class="field-label">☀️ MORNING <span class="muted">${formatSlotGroupLabel(groups.morning, "9:00 AM – 2:00 PM")}</span></label>
          <div class="slot-grid">${groups.morning.map(renderSlotButton).join("")}</div>
        </div>
      `);
    }

    if (groups.afternoon.length) {
      sections.push(`
        <div class="form-section">
          <label class="field-label">🌙 AFTERNOON <span class="muted">${formatSlotGroupLabel(groups.afternoon, "2:00 PM – 6:00 PM")}</span></label>
          <div class="slot-grid">${groups.afternoon.map(renderSlotButton).join("")}</div>
        </div>
      `);
    }

    return sections.join("");
  }

  async function render() {
    const container = root.querySelector("#book-root");
    const doctor = await getDoctor(doctorId);
    const dates = getDateOptions(3);
    const groups = await loadDaySlots();

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

      ${renderSlotSections(groups)}

      <div class="form-section">
        <label class="field-label" for="patient-name">PATIENT NAME</label>
        <input type="text" id="patient-name" class="input" placeholder="e.g. Anjali Sharma" required autocomplete="name" />
      </div>

      <div class="form-section">
        <label class="field-label" for="notes">NOTES (OPTIONAL)</label>
        <textarea id="notes" class="input" rows="2" placeholder="Symptoms or reason for visit"></textarea>
      </div>

      <button type="button" class="btn btn-primary btn-lg btn-block" id="book-btn" disabled>
        ${selectedSlot ? `Confirm ${formatTime12(selectedSlot)}` : groups.hasSlots ? "Select a time slot" : "No slots available"}
      </button>
    `;

    const nameInput = container.querySelector("#patient-name");
    const { user } = getAuth();
    if (nameInput && user?.name && !nameInput.value) {
      nameInput.value = user.name;
    }

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
    const groups = await loadDaySlots();
    root.querySelectorAll(".slot-btn").forEach((btn) => {
      const entry = groups.all.find((s) => s.time === btn.dataset.time);
      if (!entry) return;
      const status = getServerSlotAvailability(selectedDate, entry);
      if (status !== "available" && selectedSlot !== entry.time) {
        btn.disabled = true;
        btn.classList.add("disabled");
      }
    });
  });
}

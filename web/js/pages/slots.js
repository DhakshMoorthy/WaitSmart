import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

import { get } from "../api.js";
import { navigate, back, getParams } from "../router.js";

export function renderSlots(root) {
  const { doctorId, doctorName, clinicId } = getParams();
  let selectedDate = dayjs().format("YYYY-MM-DD");
  let selectedSlot = null;

  const dates = Array.from({ length: 7 }, (_, i) => dayjs().add(i, "day"));

  root.innerHTML = `
    <div class="page">
      <div class="page-header">
        <button class="back-btn" id="back-btn">← Back</button>
        <h2>Pick a Slot</h2>
        <p class="subtitle">${doctorName || ""}</p>
      </div>
      <div class="page-content">
        <div class="date-row" id="date-row">
          ${dates.map((d) => `
            <div class="date-chip ${d.format("YYYY-MM-DD") === selectedDate ? "active" : ""}" data-date="${d.format("YYYY-MM-DD")}">
              <div class="day">${d.format("ddd")}</div>
              <div class="num">${d.format("DD")}</div>
            </div>
          `).join("")}
        </div>
        <div id="slots-container">
          <div class="loading"><div class="spinner"></div><span class="loading-text">Checking availability...</span></div>
        </div>
      </div>
      <div class="page-footer" id="footer" style="display:none;">
        <div class="card mb-12" style="background:var(--accent-light); border-color:var(--accent); padding:10px 16px;">
          <div style="font-size:0.72rem; font-weight:600; color:var(--accent-dark); text-transform:uppercase; letter-spacing:0.04em;">Selected</div>
          <div style="font-weight:600; color:var(--accent-dark); margin-top:2px;" id="selected-label"></div>
        </div>
        <button class="btn btn-primary btn-lg" id="continue-btn">Continue to Book</button>
      </div>
    </div>
  `;

  root.querySelector("#back-btn").addEventListener("click", () => back());

  root.querySelectorAll(".date-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      selectedDate = chip.dataset.date;
      selectedSlot = null;
      root.querySelector("#footer").style.display = "none";
      root.querySelectorAll(".date-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      loadSlots();
    });
  });

  root.querySelector("#continue-btn").addEventListener("click", () => {
    if (selectedSlot) {
      navigate("/book-confirm", {
        doctorId,
        doctorName,
        clinicId,
        slotId: selectedSlot.id,
        slotTime: selectedSlot.slotTime,
        date: selectedDate,
      });
    }
  });

  async function loadSlots() {
    const container = root.querySelector("#slots-container");
    container.innerHTML = `<div class="loading"><div class="spinner"></div><span class="loading-text">Checking availability...</span></div>`;

    try {
      const data = await get("/avail", { doctorId, date: selectedDate });
      const slots = (data.data?.slots || []).filter((s) => s.status === "available");

      if (slots.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="icon">📅</div>
            <h3>No available slots</h3>
            <p>Try another date</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `<div class="slots-grid">${slots.map((s) => `
        <div class="slot-chip" data-id="${s.id}" data-time="${s.slotTime}">
          ${dayjs.utc(s.slotTime).format("h:mm A")}
        </div>
      `).join("")}</div>`;

      container.querySelectorAll(".slot-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          container.querySelectorAll(".slot-chip").forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");
          selectedSlot = { id: chip.dataset.id, slotTime: chip.dataset.time };
          root.querySelector("#footer").style.display = "block";
          root.querySelector("#selected-label").textContent =
            `${dayjs(selectedDate).format("ddd, MMM D")} at ${dayjs.utc(chip.dataset.time).format("h:mm A")}`;
        });
      });
    } catch {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">⚠️</div>
          <h3>Failed to load slots</h3>
          <p>Please try again</p>
        </div>
      `;
    }
  }

  loadSlots();
}

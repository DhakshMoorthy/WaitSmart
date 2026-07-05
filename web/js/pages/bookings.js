import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

import { get } from "../api.js";
import { navigate, back } from "../router.js";

const STATUS_BADGE = {
  waiting: "badge-primary",
  "in-cabin": "badge-success",
  done: "badge-neutral",
  cancelled: "badge-danger",
  "no-show": "badge-danger",
};

export function renderBookings(root) {
  root.innerHTML = `
    <div class="page">
      <div class="page-header">
        <button class="back-btn" id="back-btn">← Back</button>
        <h2>My Bookings</h2>
      </div>
      <div class="page-content" id="bookings-list">
        <div class="loading"><div class="spinner"></div><span class="loading-text">Loading bookings...</span></div>
      </div>
    </div>
  `;

  root.querySelector("#back-btn").addEventListener("click", () => back());

  loadBookings(root);
}

async function loadBookings(root) {
  const listEl = root.querySelector("#bookings-list");

  try {
    const data = await get("/patients/history");
    const bookings = data.data || [];

    if (bookings.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="icon">📋</div>
          <h3>No bookings yet</h3>
          <p>Your appointment history will appear here.</p>
          <button class="btn btn-primary mt-20" style="width:auto;" id="book-now">Book Now</button>
        </div>
      `;
      listEl.querySelector("#book-now")?.addEventListener("click", () => navigate("/clinics"));
      return;
    }

    listEl.innerHTML = bookings.map((b) => `
      <div class="card ${b.status === "waiting" ? "clickable" : ""}" data-booking='${JSON.stringify(b)}'>
        <div class="booking-card">
          <div class="token-badge">#${b.tokenNumber}</div>
          <div class="info">
            <div class="doctor">${b.doctorName || "Doctor"}</div>
            <div class="meta">
              ${b.date ? dayjs(b.date).format("MMM D, YYYY") : "—"}${b.slotTime ? ` · ${dayjs.utc(b.slotTime).format("h:mm A")}` : ""}
            </div>
          </div>
          <span class="badge ${STATUS_BADGE[b.status] || "badge-neutral"}">${b.status}</span>
        </div>
      </div>
    `).join("");

    listEl.querySelectorAll(".card.clickable").forEach((card) => {
      card.addEventListener("click", () => {
        const b = JSON.parse(card.dataset.booking);
        navigate("/ticket", {
          appointmentId: b.id,
          tokenNumber: String(b.tokenNumber),
          doctorName: b.doctorName,
          slotTime: b.slotTime,
          date: b.date,
          status: b.status,
          doctorId: b.doctorId,
        });
      });
    });
  } catch (err) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">⚠️</div>
        <h3>Failed to load</h3>
        <p>${err.message}</p>
      </div>
    `;
  }
}

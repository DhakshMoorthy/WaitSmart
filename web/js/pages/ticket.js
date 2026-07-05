import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

import { replace, getParams } from "../router.js";
import { connectSocket, getSocket, subscribeToQueue, SOCKET_EVENTS } from "../socket.js";

export function renderTicket(root) {
  const { tokenNumber, doctorName, slotTime, date, status, doctorId } = getParams();

  let nowServing = null;

  root.innerHTML = `
    <div class="page">
      <div class="page-content" style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
        <div style="font-size:2.5rem; margin-bottom:12px;">✅</div>
        <h2>Booking Confirmed</h2>

        <div class="token-display">
          <div class="token-label">Your Token</div>
          <div class="token-number">${tokenNumber}</div>
          <span class="badge badge-primary" id="status-badge">${status || "Waiting"}</span>
        </div>

        <div class="card" style="width:100%; text-align:left;">
          <div class="summary-list">
            <div class="summary-row">
              <span class="label">Doctor</span>
              <span class="value">${doctorName}</span>
            </div>
            <div class="summary-row">
              <span class="label">Date</span>
              <span class="value">${dayjs(date).format("ddd, MMM D")}</span>
            </div>
            <div class="summary-row">
              <span class="label">Time</span>
              <span class="value">${dayjs.utc(slotTime).format("h:mm A")}</span>
            </div>
            <div class="summary-row" id="now-serving-row" style="display:none;">
              <span class="label">Now Serving</span>
              <span class="value" id="now-serving-val"></span>
            </div>
            <div class="summary-row" id="position-row" style="display:none;">
              <span class="label">Your Position</span>
              <span class="value" id="position-val" style="color:var(--warning);"></span>
            </div>
          </div>
        </div>

        <div class="alert alert-success mt-16" id="turn-alert" style="display:none; width:100%;">
          🎉 It's your turn! Please proceed to the doctor's cabin.
        </div>
      </div>
      <div class="page-footer">
        <button class="btn btn-outline btn-lg" id="home-btn">Back to Home</button>
      </div>
    </div>
  `;

  root.querySelector("#home-btn").addEventListener("click", () => replace("/home"));

  connectSocket();
  subscribeToQueue(doctorId);

  const socket = getSocket();
  socket.on(SOCKET_EVENTS.QUEUE_UPDATE, (data) => {
    if (data.doctorId === doctorId && data.nowServing != null) {
      nowServing = data.nowServing;
      updateQueueDisplay();
    }
  });

  function updateQueueDisplay() {
    if (nowServing == null) return;
    const myToken = Number(tokenNumber);
    const position = myToken - nowServing;
    const isMyTurn = position <= 0;

    root.querySelector("#now-serving-row").style.display = "flex";
    root.querySelector("#now-serving-val").textContent = `#${nowServing}`;

    if (isMyTurn) {
      root.querySelector("#turn-alert").style.display = "block";
      root.querySelector("#status-badge").className = "badge badge-success";
      root.querySelector("#status-badge").textContent = "Your turn!";
      root.querySelector("#position-row").style.display = "none";
    } else if (position > 0) {
      root.querySelector("#position-row").style.display = "flex";
      root.querySelector("#position-val").textContent = `${position} ahead of you`;
    }
  }
}

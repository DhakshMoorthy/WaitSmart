import { io } from "socket.io-client";
import { getAuth } from "./auth.js";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

let socket = null;

export const SOCKET_EVENTS = {
  QUEUE_SUBSCRIBE: "queue:subscribe",
  QUEUE_UNSUBSCRIBE: "queue:unsubscribe",
  QUEUE_UPDATE: "queue:update",
  BOOKING_CREATED: "booking:created",
};

export function getSocket() {
  if (!socket) {
    socket = io(BASE_URL, {
      auth: { token: getAuth().accessToken },
      transports: ["websocket"],
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  s.auth = { token: getAuth().accessToken };
  if (!s.connected) {
    s.connect();
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function subscribeToQueue(doctorId) {
  const s = getSocket();
  s.emit(SOCKET_EVENTS.QUEUE_SUBSCRIBE, doctorId);
}

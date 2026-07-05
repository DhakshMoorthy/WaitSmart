import { io, Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "@waitsmart/shared";
import { useAuthStore } from "../stores/auth";

import { Platform } from "react-native";

const BASE_URL = __DEV__
  ? Platform.OS === "android"
    ? "http://10.0.2.2:4000"
    : "http://localhost:4000"
  : "https://api.waitsmart.app";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BASE_URL, {
      auth: (cb) => {
        cb({ token: useAuthStore.getState().accessToken });
      },
      transports: ["websocket"],
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  s.auth = { token: useAuthStore.getState().accessToken };
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

export function subscribeToQueue(doctorId: string) {
  const s = getSocket();
  s.emit(SOCKET_EVENTS.QUEUE_SUBSCRIBE, doctorId);
}

export function unsubscribeFromQueue(doctorId: string) {
  const s = getSocket();
  s.emit(SOCKET_EVENTS.QUEUE_UNSUBSCRIBE, doctorId);
}

export { SOCKET_EVENTS };

import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@waitsmart/shared';
import { getAuth } from './auth';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

let socket: Socket | null = null;
const connectionListeners = new Set<(connected: boolean) => void>();

function notifyConnection(connected: boolean) {
  connectionListeners.forEach((fn) => fn(connected));
}

export function subscribeSocketConnection(fn: (connected: boolean) => void) {
  connectionListeners.add(fn);
  const s = getSocket();
  fn(s.connected);
  return () => connectionListeners.delete(fn);
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BASE_URL, {
      auth: { token: getAuth().accessToken },
      transports: ['websocket'],
      autoConnect: false,
    });
    socket.on('connect', () => notifyConnection(true));
    socket.on('disconnect', () => notifyConnection(false));
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
    notifyConnection(false);
  }
}

export function subscribeToQueue(doctorId: string) {
  const s = getSocket();
  s.emit(SOCKET_EVENTS.QUEUE_SUBSCRIBE, doctorId);
}

export function unsubscribeFromQueue(doctorId: string) {
  const s = getSocket();
  if (s.connected) {
    s.emit(SOCKET_EVENTS.QUEUE_UNSUBSCRIBE, doctorId);
  }
}

export { SOCKET_EVENTS };

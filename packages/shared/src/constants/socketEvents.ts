/** Socket.io event names — keep in sync with mobile clients */
export const SOCKET_EVENTS = {
  QUEUE_SUBSCRIBE: "queue:subscribe",
  QUEUE_UNSUBSCRIBE: "queue:unsubscribe",
  QUEUE_UPDATE: "queue:update",
  BOOKING_CREATED: "booking:created",
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

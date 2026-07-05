import type { Server, Socket } from "socket.io";
import { SOCKET_EVENTS } from "@waitsmart/shared";

export function registerQueueHandlers(_io: Server, socket: Socket) {
  socket.on(SOCKET_EVENTS.QUEUE_SUBSCRIBE, (doctorId: string) => {
    socket.join(`queue:${doctorId}`);
  });

  socket.on(SOCKET_EVENTS.QUEUE_UNSUBSCRIBE, (doctorId: string) => {
    socket.leave(`queue:${doctorId}`);
  });
}

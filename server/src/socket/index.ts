import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { corsOriginCallback } from "../config/corsPolicy.js";
import { registerQueueHandlers } from "./queueHandler.js";
import { logger } from "../utils/logger.js";

let io: Server | undefined;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: corsOriginCallback, credentials: true },
  });

  io.on("connection", (socket) => {
    logger.debug(`Socket connected: ${socket.id}`);
    registerQueueHandlers(io!, socket);
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.io not initialized — call initSocket first");
  }
  return io;
}

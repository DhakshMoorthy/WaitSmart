import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { corsOrigins } from "../config/env.js";
import { registerQueueHandlers } from "./queueHandler.js";
import { logger } from "../utils/logger.js";

let io: Server | undefined;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: corsOrigins, credentials: true },
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

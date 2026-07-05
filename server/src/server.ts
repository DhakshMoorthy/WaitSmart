import { createServer } from "http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectRedis } from "./config/redis.js";
import { logger } from "./utils/logger.js";
import { initSocket } from "./socket/index.js";

async function main() {
  await connectRedis();

  const httpServer = createServer(app);
  initSocket(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(`WaitSmart API listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  logger.error("Fatal startup error", { err });
  process.exit(1);
});

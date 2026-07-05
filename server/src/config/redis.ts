import { createClient } from "redis";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

export const redis = createClient({ url: env.REDIS_URL });

redis.on("error", (err) => logger.error("Redis error", { err }));

export async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect();
    logger.info("Redis connected");
  }
}

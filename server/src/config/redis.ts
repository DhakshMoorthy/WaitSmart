import { createClient } from "redis";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

export const redis = createClient({ url: env.REDIS_URL });

/** Namespaces a Redis key per environment (REDIS_KEY_PREFIX), so prod and test can share one instance. */
export const redisKey = (name: string) => `${env.REDIS_KEY_PREFIX}${name}`;

redis.on("error", (err) => logger.error("Redis error", { err }));

export async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect();
    logger.info("Redis connected");
  }
}

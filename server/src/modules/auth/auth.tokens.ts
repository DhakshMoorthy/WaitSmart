import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { redis } from "../../config/redis.js";
import { users } from "../../db/schema/index.js";
import { AppError } from "../../types/index.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt.js";

/**
 * Refresh tokens are single-use and tracked server-side in Redis as `rt:{userId}:{jti}`.
 *  - every refresh rotates: the old token dies, a new one is issued
 *  - presenting an already-used token (theft signal) revokes ALL of that user's sessions
 *  - logout deletes the token
 *  - role / tenant are re-read from the database on every refresh, so demotions take effect
 */
const key = (userId: string, jti: string) => `rt:${userId}:${jti}`;

export async function issueTokens(user: typeof users.$inferSelect) {
  const payload = {
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
  };
  const jti = crypto.randomUUID();
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload, jti);

  const { exp } = verifyRefreshToken(refreshToken);
  const ttl = Math.max(1, (exp ?? 0) - Math.floor(Date.now() / 1000));
  await redis.set(key(user.id, jti), "1", { EX: ttl });

  return { accessToken, refreshToken };
}

async function revokeAllForUser(userId: string) {
  for await (const k of redis.scanIterator({ MATCH: `rt:${userId}:*`, COUNT: 100 })) {
    await redis.del(k);
  }
}

export async function rotateRefreshToken(refreshToken: string) {
  const invalid = () => new AppError(401, "Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw invalid();
  }
  if (!payload.jti) throw invalid(); // pre-rotation token: force a fresh login

  const consumed = await redis.del(key(payload.userId, payload.jti));
  if (consumed === 0) {
    // Valid signature but not on the allow-list: already used or revoked.
    await revokeAllForUser(payload.userId);
    throw invalid();
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, payload.userId) });
  if (!user) throw new AppError(401, "User no longer exists", "INVALID_REFRESH_TOKEN");

  return issueTokens(user);
}

export async function revokeRefreshToken(refreshToken: string) {
  try {
    const payload = verifyRefreshToken(refreshToken);
    if (payload.jti) await redis.del(key(payload.userId, payload.jti));
  } catch {
    // Already invalid/expired — nothing to revoke.
  }
}

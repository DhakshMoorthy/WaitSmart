import { eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { users } from "../../db/schema/index.js";
import { hashPassword, comparePassword } from "../../utils/hash.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt.js";
import { AppError } from "../../types/index.js";
import type { RegisterInput, LoginInput } from "./auth.validator.js";

function toJwtPayload(user: typeof users.$inferSelect) {
  return {
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
  };
}

function issueTokens(user: typeof users.$inferSelect) {
  const payload = toJwtPayload(user);
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export async function registerUser(input: RegisterInput, tenantId: string | null) {
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  if (existing) {
    throw new AppError(409, "Email already registered", "EMAIL_TAKEN");
  }

  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({
      tenantId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: input.role as (typeof users.$inferInsert)["role"],
    })
    .returning();

  const tokens = issueTokens(user);
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, ...tokens };
}

export async function loginUser(input: LoginInput) {
  const user = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  if (!user) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  const tokens = issueTokens(user);
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, ...tokens };
}

export async function refreshTokens(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, "Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, payload.userId) });
  if (!user) {
    throw new AppError(401, "User no longer exists", "INVALID_REFRESH_TOKEN");
  }

  return issueTokens(user);
}

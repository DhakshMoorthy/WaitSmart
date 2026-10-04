import { eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { users } from "../../db/schema/index.js";
import { hashPassword, comparePassword } from "../../utils/hash.js";
import { issueTokens, rotateRefreshToken } from "./auth.tokens.js";
import { AppError } from "../../types/index.js";
import type { RegisterInput, LoginInput } from "./auth.validator.js";

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
      role: "patient",
    })
    .returning();

  const tokens = await issueTokens(user);
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

  const tokens = await issueTokens(user);
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, ...tokens };
}

export const refreshTokens = rotateRefreshToken;

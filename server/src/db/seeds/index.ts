import crypto from "crypto";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "../../config/db.js";
import { env } from "../../config/env.js";
import { tenants } from "../schema/tenants.js";
import { users } from "../schema/users.js";
import { hashPassword, comparePassword } from "../../utils/hash.js";
import { logger } from "../../utils/logger.js";
import { KNOWN_DEV_PASSWORDS, LEGACY_SAMPLE_EMAILS } from "./known-passwords.js";
import { cleanupLegacySampleData, DEMO_TENANT_NAME } from "./legacy-cleanup.js";
import { seedChennaiClinics } from "./chennai-clinics.js";
import { seedTestData } from "./test-data.js";

const isProd = env.NODE_ENV === "production";

/**
 * Production only: any account from the ORIGINAL seed that still uses a published password gets a
 * random one. Limited to those known emails, so the cost does not grow with the number of users.
 */
async function neutralizeKnownPasswords() {
  const legacy = await db.select().from(users).where(inArray(users.email, LEGACY_SAMPLE_EMAILS));
  for (const u of legacy) {
    for (const known of KNOWN_DEV_PASSWORDS) {
      if (await comparePassword(known, u.passwordHash)) {
        const randomHash = await hashPassword(crypto.randomBytes(24).toString("hex"));
        await db.update(users).set({ passwordHash: randomHash, updatedAt: new Date() }).where(eq(users.id, u.id));
        logger.warn(`Rotated published seed password for ${u.email}`);
        break;
      }
    }
  }
}

/**
 * Superadmin credentials come from the environment.
 * Dev: falls back to the documented defaults. Production: skipped unless both are set.
 */
function superadminCredentials(): { email: string; password: string } | null {
  const email = process.env.SUPERADMIN_EMAIL || (isProd ? undefined : "superadmin@waitsmart.app");
  const password = process.env.SUPERADMIN_PASSWORD || (isProd ? undefined : "Admin@1234");
  if (!email || !password) return null;
  if (isProd && password.length < 12) {
    throw new Error("SUPERADMIN_PASSWORD must be at least 12 characters in production");
  }
  return { email, password };
}

async function seed() {
  logger.info("Seeding database...");

  if (isProd) await neutralizeKnownPasswords();

  // 1. Superadmin (no tenant).
  const creds = superadminCredentials();
  if (!creds) {
    logger.warn("SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD not set - skipping superadmin creation");
  } else {
    // users.email has no unique constraint, so onConflictDoNothing() would never fire and every
    // deploy would insert another superadmin row. Check explicitly instead.
    const existing = await db.query.users.findFirst({ where: eq(users.email, creds.email) });
    if (existing) {
      logger.info("Superadmin already exists, skipping");
    } else {
      const [superadmin] = await db
        .insert(users)
        .values({
          name: "Super Admin",
          email: creds.email,
          phone: "+919999900000",
          passwordHash: await hashPassword(creds.password),
          role: "superadmin",
          tenantId: null,
        })
        .returning();
      logger.info(`Created superadmin: ${superadmin.email}`);
    }
  }

  // 2. Default tenant: the clinic group every phone-login patient joins.
  const [created] = await db
    .insert(tenants)
    .values({
      name: DEMO_TENANT_NAME,
      slug: env.DEFAULT_TENANT_SLUG,
      subdomain: "apollo",
      branding: { primaryColor: "#2563eb", appName: "WaitSmart" },
    })
    .onConflictDoNothing()
    .returning();
  if (created) logger.info(`Created default tenant: ${created.name} (${created.id})`);

  // 3. Remove the fake sample data from earlier versions, then load the real clinics + test data.
  await cleanupLegacySampleData();
  await seedChennaiClinics();
  await seedTestData();

  logger.info("Seeding complete!");
  await pool.end();
}

seed().catch((err) => {
  logger.error("Seed failed", { err });
  process.exit(1);
});

import { and, eq, inArray, like, or } from "drizzle-orm";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { clinics } from "../schema/clinics.js";
import { tenants } from "../schema/tenants.js";
import { users } from "../schema/users.js";
import { logger } from "../../utils/logger.js";
import { LEGACY_SAMPLE_EMAILS } from "./known-passwords.js";

/** Clinics created by the ORIGINAL sample seed (fake addresses). Deleting a clinic cascades to its doctors, slots and appointments. */
const LEGACY_CLINIC_NAMES = ["Apollo Main Branch", "Apollo — Anna Nagar"];

/** Sample accounts from the original seed (the superadmin one is handled separately below). */
const LEGACY_USER_EMAILS = LEGACY_SAMPLE_EMAILS.filter((e) => e !== "superadmin@waitsmart.app");

const OLD_DEFAULT_SUPERADMIN = "superadmin@waitsmart.app";
const SAMPLE_TENANT_NAME = "Apollo Clinic";
export const DEMO_TENANT_NAME = "Chennai Demo Clinics";

/**
 * One-time-style cleanup, safe to run on every deploy (it only matches exact, known-fake rows):
 *  - fake sample clinics + their doctors/bookings
 *  - sample users that shipped with published passwords, and debris from manual smoke tests
 *  - duplicate superadmin rows created by an old seed bug (users.email is not unique)
 *  - the old default superadmin account, once a different SUPERADMIN_EMAIL is configured
 *  - the default tenant's sample display name
 */
export async function cleanupLegacySampleData() {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, env.DEFAULT_TENANT_SLUG) });

  if (tenant) {
    const removedClinics = await db
      .delete(clinics)
      .where(and(eq(clinics.tenantId, tenant.id), inArray(clinics.name, LEGACY_CLINIC_NAMES)))
      .returning({ name: clinics.name });
    if (removedClinics.length) {
      logger.info(`Cleanup: removed fake sample clinics: ${removedClinics.map((c) => c.name).join(", ")}`);
    }

    if (tenant.name === SAMPLE_TENANT_NAME) {
      await db
        .update(tenants)
        .set({ name: DEMO_TENANT_NAME, branding: { primaryColor: "#2563eb", appName: "WaitSmart" }, updatedAt: new Date() })
        .where(eq(tenants.id, tenant.id));
      logger.info(`Cleanup: renamed default tenant to "${DEMO_TENANT_NAME}"`);
    }
  }

  const removedUsers = await db
    .delete(users)
    .where(
      or(
        inArray(users.email, LEGACY_USER_EMAILS),
        // debris from manual API smoke tests against the live deployment
        like(users.email, "probe-%@example.com"),
        eq(users.phone, "+919000000003"),
      ),
    )
    .returning({ email: users.email });
  if (removedUsers.length) logger.info(`Cleanup: removed ${removedUsers.length} sample/test user(s)`);

  // Duplicate superadmin rows (same email) from the old onConflictDoNothing() bug: keep the oldest.
  const supers = await db.select().from(users).where(eq(users.role, "superadmin")).orderBy(users.createdAt);
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const u of supers) {
    if (seen.has(u.email)) dupes.push(u.id);
    else seen.add(u.email);
  }
  if (dupes.length) {
    await db.delete(users).where(inArray(users.id, dupes));
    logger.info(`Cleanup: removed ${dupes.length} duplicate superadmin row(s)`);
  }

  // The leaked-credential default superadmin is no longer needed once a different one is configured.
  const configured = process.env.SUPERADMIN_EMAIL;
  if (configured && configured !== OLD_DEFAULT_SUPERADMIN) {
    const old = await db
      .delete(users)
      .where(and(eq(users.email, OLD_DEFAULT_SUPERADMIN), eq(users.role, "superadmin")))
      .returning({ id: users.id });
    if (old.length) logger.info("Cleanup: removed the old default superadmin account");
  }
}

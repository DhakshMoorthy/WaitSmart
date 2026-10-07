import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq } from "drizzle-orm";
import { api, createTestTenant } from "./helpers.js";
import { db } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import { redis } from "../src/config/redis.js";
import { clinics, users } from "../src/db/schema/index.js";
import { loadDataset } from "../src/db/seeds/datasets.js";
import { seedDemoClinics } from "../src/db/seeds/demo-clinics.js";
import { adminLoginEmail, doctorLoginEmail, seedTestData, testPatients } from "../src/db/seeds/test-data.js";

/**
 * Production and the test environment share ONE Postgres (and Redis). Each environment has its own default
 * tenant + dataset, so they must never see each other's clinics, accounts or patients.
 */
const PROD = { slug: "apollo-clinic", dataset: loadDataset("chennai") };
const TEST = { slug: "us-uk-demo", dataset: loadDataset("us-uk") };
const PASSWORD = "Shared#Db99";

describe("two environments sharing one database", () => {
  let prodTenantId: string;
  let testTenantId: string;
  const originalSlug = env.DEFAULT_TENANT_SLUG;

  const asEnv = (e: { slug: string }) => {
    env.DEFAULT_TENANT_SLUG = e.slug;
  };

  beforeAll(async () => {
    prodTenantId = (await createTestTenant({ slug: PROD.slug, subdomain: `p-${Date.now()}` })).id;
    testTenantId = (await createTestTenant({ slug: TEST.slug, subdomain: `t-${Date.now()}` })).id;

    process.env.SEED_TEST_DATA = "true";
    process.env.TEST_ACCOUNTS_PASSWORD = PASSWORD;
    for (const e of [PROD, TEST]) {
      asEnv(e); // what each service's DEFAULT_TENANT_SLUG would be
      await seedDemoClinics(e.dataset.id);
      await seedTestData(e.dataset.id);
    }
  });

  afterAll(() => {
    env.DEFAULT_TENANT_SLUG = originalSlug;
    env.REDIS_KEY_PREFIX = "";
    delete process.env.SEED_TEST_DATA;
    delete process.env.TEST_ACCOUNTS_PASSWORD;
  });

  it("each environment has its own clinics", async () => {
    expect(await db.select().from(clinics).where(eq(clinics.tenantId, prodTenantId))).toHaveLength(5);
    expect(await db.select().from(clinics).where(eq(clinics.tenantId, testTenantId))).toHaveLength(6);
  });

  it("test accounts are separate (different emails, phones and tenants) so seeds never touch each other", async () => {
    expect(adminLoginEmail(PROD.dataset)).not.toBe(adminLoginEmail(TEST.dataset));

    const prodAdmin = await db.query.users.findFirst({ where: eq(users.email, adminLoginEmail(PROD.dataset)) });
    const testAdmin = await db.query.users.findFirst({ where: eq(users.email, adminLoginEmail(TEST.dataset)) });
    expect(prodAdmin?.tenantId).toBe(prodTenantId);
    expect(testAdmin?.tenantId).toBe(testTenantId);

    const pp = testPatients(PROD.dataset).map((p) => p.phone);
    const tp = testPatients(TEST.dataset).map((p) => p.phone);
    expect(pp.some((p) => tp.includes(p))).toBe(false);
  });

  it("an admin only sees the clinics of their own environment", async () => {
    for (const [e, expectedName] of [
      [PROD, "Apollo Clinic - Velachery"],
      [TEST, "Mayo Clinic - Rochester"],
    ] as const) {
      const login = await api.post("/auth/login").send({ email: adminLoginEmail(e.dataset), password: PASSWORD });
      expect(login.status).toBe(200);
      const list = await api.get("/clinics").set("Authorization", `Bearer ${login.body.accessToken}`);
      const names = list.body.data.map((c: { name: string }) => c.name);
      expect(names).toContain(expectedName);
      expect(names).toHaveLength(e.dataset.clinics.length);
    }
  });

  it("the same phone number is a separate patient in each environment", async () => {
    const phone = "+919811200001";
    const patientFor = async (e: { slug: string }) => {
      asEnv(e);
      const send = await api.post("/auth/otp/send").send({ phone });
      const res = await api.post("/auth/otp/verify").send({ phone, otp: send.body.devOtp });
      expect(res.status).toBe(200);
      return res.body;
    };

    const inTest = await patientFor(TEST);
    const inProd = await patientFor(PROD);
    expect(inTest.user.tenantId).toBe(testTenantId);
    expect(inProd.user.tenantId).toBe(prodTenantId);
    expect(inTest.user.id).not.toBe(inProd.user.id);

    // ...and each one only sees its own environment's hospitals
    const names = async (body: { accessToken: string }) =>
      (await api.get("/clinics").set("Authorization", `Bearer ${body.accessToken}`)).body.data.map((c: { name: string }) => c.name);
    expect(await names(inTest)).toContain("Guy's Hospital - London");
    expect(await names(inTest)).not.toContain("Apollo Clinic - Velachery");
    expect(await names(inProd)).toContain("Apollo Clinic - Velachery");

    // signing in again in the same environment returns the SAME patient, not a new one
    const again = await patientFor(TEST);
    expect(again.user.id).toBe(inTest.user.id);
    expect(await db.select().from(users).where(and(eq(users.phone, phone), eq(users.role, "patient")))).toHaveLength(2);
  });

  it("doctor logins are per environment too", async () => {
    const d = await db.query.users.findFirst({ where: eq(users.email, doctorLoginEmail(TEST.dataset, "mayo")) });
    expect(d?.tenantId).toBe(testTenantId);
    expect(await db.query.users.findFirst({ where: eq(users.email, doctorLoginEmail(PROD.dataset, "mayo")) })).toBeUndefined();
  });

  it("REDIS_KEY_PREFIX keeps each environment's OTP keys apart", async () => {
    const phone = "+919811200002";
    env.REDIS_KEY_PREFIX = "test:";
    await api.post("/auth/otp/send").send({ phone });
    expect(await redis.get(`test:otp:${phone}`)).toMatch(/^\d{6}$/);
    expect(await redis.get(`otp:${phone}`)).toBeNull(); // prod's key space is untouched

    env.REDIS_KEY_PREFIX = "";
    await api.post("/auth/otp/send").send({ phone });
    expect(await redis.get(`otp:${phone}`)).toMatch(/^\d{6}$/);
  });
});

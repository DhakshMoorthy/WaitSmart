import { beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/config/db.js";
import { redis, connectRedis } from "../src/config/redis.js";

beforeAll(async () => {
  await connectRedis();

  // Ensure schema is pushed to the test database.
  // If tables don't exist, tell user to run: pnpm db:push:test
  try {
    await db.execute(sql`SELECT 1 FROM tenants LIMIT 0`);
  } catch {
    throw new Error(
      "Test database schema not found. Run: pnpm db:push:test\n" +
      "(Requires Docker services running: docker compose -f infra/docker/docker-compose.yml up -d)",
    );
  }

  // Truncate all tables
  await db.execute(sql`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
      ) LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);

  // Clear Redis test data
  await redis.flushDb();
});

afterAll(async () => {
  await redis.quit();
  await pool.end();
});

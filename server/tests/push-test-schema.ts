import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://waitsmart:waitsmart@localhost:5432/waitsmart_test",
});

async function main() {
  const client = await pool.connect();
  try {
    const exists = await client.query(
      "SELECT to_regclass('public.tenants') AS table_name",
    );
    if (exists.rows[0]?.table_name) {
      console.log("Test schema already present");
    } else {
      const sql = readFileSync(resolve(__dirname, "schema.sql"), "utf8");
      await client.query(sql);
      console.log("Applied test schema");
    }

    // schema.sql is a snapshot of 0000_initial; later migrations must be layered on top.
    // They are written to be idempotent (IF NOT EXISTS), so this is safe on every run.
    const migrationsDir = resolve(__dirname, "../src/db/migrations");
    const later = readdirSync(migrationsDir)
      .filter((f) => /^\d{4}_.*\.sql$/.test(f) && !f.startsWith("0000_"))
      .sort();
    for (const file of later) {
      await client.query(readFileSync(resolve(migrationsDir, file), "utf8"));
      console.log(`Applied migration ${file}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Failed to push test schema:", err.message);
  process.exit(1);
});

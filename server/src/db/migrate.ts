import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../config/db.js";
import { logger } from "../utils/logger.js";

async function run() {
  logger.info("Running migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  logger.info("Migrations complete");
  await pool.end();
}

run().catch((err) => {
  logger.error("Migration failed", { err });
  process.exit(1);
});

import { Pool } from "pg";

const adminPool = new Pool({
  connectionString: "postgresql://waitsmart:waitsmart@localhost:5432/postgres",
});

async function main() {
  const client = await adminPool.connect();
  try {
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'waitsmart_test'",
    );
    if (result.rows.length === 0) {
      await client.query("CREATE DATABASE waitsmart_test");
      console.log("Created waitsmart_test database");
    } else {
      console.log("waitsmart_test database already exists");
    }
  } finally {
    client.release();
    await adminPool.end();
  }
}

main().catch((err) => {
  console.error("Failed to create test database:", err.message);
  process.exit(1);
});

// db/migrate.mjs
// Apply all SQL files in db/ in lexical order, idempotently.
// Each migration is run inside a transaction. We record which files
// have already run in `_migrations` so we don't re-apply them.
//
// Usage:
//   node db/migrate.mjs
//
// Requires DATABASE_URL.

import { readdir, readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// Load .env.local first (Next.js convention), then .env, so DATABASE_URL
// is set without requiring the caller to export it. We avoid dotenv deps
// to keep the script standalone.
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2];
  }
}
loadEnvFile(join(PROJECT_ROOT, ".env.local"));
loadEnvFile(join(PROJECT_ROOT, ".env"));
const DB_DIR = __dirname;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(2);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name        TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Skip seed.sql — it's invoked explicitly by db/seed.sh, not on every
    // migrate run. (Idempotent, but adds noise to migration history.)
    const files = (await readdir(DB_DIR))
      .filter((f) => f.endsWith(".sql") && f !== "seed.sql" && f !== "schema.prisma")
      .sort();

    for (const file of files) {
      const { rowCount } = await client.query(
        "SELECT 1 FROM _migrations WHERE name = $1",
        [file]
      );
      if (rowCount > 0) {
        console.log(`SKIP  ${file} (already applied)`);
        continue;
      }
      const sql = await readFile(join(DB_DIR, file), "utf8");
      console.log(`APPLY ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
    console.log("Migrations complete.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

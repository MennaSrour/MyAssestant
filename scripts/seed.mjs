import { readFile } from "node:fs/promises";
import pg from "pg";

if (!process.env.DATABASE_URL)
  throw new Error(
    "Set DATABASE_URL for the local seed. Supabase seeds on first login.",
  );
const entries = await readFile(
  new URL("../lib/seed.json", import.meta.url),
  "utf8",
);
const schema = await readFile(
  new URL("../prisma/local.sql", import.meta.url),
  "utf8",
);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query(schema);
  await client.query(
    "insert into workspaces (owner_id, entries) values ($1, $2::jsonb) on conflict (owner_id) do nothing",
    ["00000000-0000-4000-8000-000000000001", entries],
  );
} finally {
  await client.end();
}

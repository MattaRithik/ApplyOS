import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";

// An operator convenience for fresh databases; does not connect to Supabase.
// Existing deployments apply only migrations missing from their ledger.
const migrations = (await readdir("supabase/migrations"))
  .filter((file) => /^\d{14}_[a-z0-9_]+\.sql$/.test(file))
  .sort();
const paths = ["supabase/schema.sql", ...migrations.map((file) => `supabase/migrations/${file}`)];
const sections = await Promise.all(
  paths.map(async (path) => `-- Source: ${path}\n${await readFile(path, "utf8")}`),
);
await mkdir("dist/database", { recursive: true });
await writeFile(
  "dist/database/bootstrap.sql",
  "-- FRESH DATABASES ONLY. Do not replay over a deployed database.\n\n" + sections.join("\n\n"),
);
console.log(
  `Wrote dist/database/bootstrap.sql from the baseline and ${migrations.length} ordered migrations. No database was accessed.`,
);

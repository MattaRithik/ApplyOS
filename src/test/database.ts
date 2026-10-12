import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

/** Disposable Supabase-compatible fixture. Never reads environment credentials. */
export async function createAppDatabase() {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create publication supabase_realtime;
      grant usage on schema public, auth to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
      grant select on auth.users to service_role;
    `);
    // PostgreSQL supplies gen_random_uuid natively; PGlite does not ship
    // pgcrypto. Everything else executes unchanged, including actual RLS.
    const baseline = (await readFile("supabase/schema.sql", "utf8")).replace(
      'create extension if not exists "pgcrypto";',
      "",
    );
    await db.exec(baseline);
    const migrations = (await readdir("supabase/migrations"))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const file of migrations) {
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    }
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

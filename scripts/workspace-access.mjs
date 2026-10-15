import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

nextEnv.loadEnvConfig(process.cwd());
const [action, targetId, flag, destination, ...extra] = process.argv.slice(2);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (
  !["block", "restore"].includes(action) ||
  !uuid.test(targetId ?? "") ||
  extra.length ||
  (flag && (flag !== "--prepare-sql" || !destination))
) {
  throw new Error(
    "Usage: node scripts/workspace-access.mjs <block|restore> <user-id> [--prepare-sql <file.sql>]",
  );
}
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const ownerEmail = process.env.APP_OWNER_EMAIL?.trim().toLowerCase();
if (!ownerEmail) throw new Error("APP_OWNER_EMAIL is required.");
const { data: profile, error: lookup } = await db
  .from("profiles")
  .select("id")
  .eq("email", ownerEmail)
  .single();
if (lookup || !profile) throw new Error("The configured owner's profile could not be resolved.");
const [owner, target, role] = await Promise.all([
  db.auth.admin.getUserById(profile.id),
  db.auth.admin.getUserById(targetId),
  db.from("app_user_roles").select("role,revoked_at").eq("user_id", profile.id).maybeSingle(),
]);
if (
  owner.error ||
  !owner.data.user?.email_confirmed_at ||
  owner.data.user.email?.toLowerCase() !== ownerEmail ||
  role.error ||
  role.data?.role !== "owner" ||
  role.data.revoked_at
)
  throw new Error("A verified configured owner with an active owner role is required.");
if (target.error || !target.data.user) throw new Error("Target account was not found.");
if (targetId === profile.id) throw new Error("The configured owner cannot be restricted.");
if (
  action === "block" &&
  target.data.user.banned_until &&
  Date.parse(target.data.user.banned_until) > Date.now()
)
  throw new Error(
    "This account is auth-banned. Enable sign-in before choosing download-only access.",
  );
const blocked = action === "block";
const requestId = randomUUID();
if (flag === "--prepare-sql") {
  const migration = await readFile(
    "supabase/migrations/20261013220000_workspace_export_only.sql",
    "utf8",
  );
  const statement = `select public.admin_set_workspace_access('${profile.id}'::uuid, '${targetId}'::uuid, ${blocked}, '${requestId}');\n`;
  const sql =
    "-- Deploy the application code first, then run this complete script in Supabase SQL Editor.\n-- Installs the restriction guards and changes only the selected account. Does not delete data.\n" +
    migration.replace(/commit;\s*$/i, statement + "\ncommit;\n");
  await writeFile(destination, sql, { mode: 0o600 });
  console.log(`Prepared ${destination}. No account or database settings were changed.`);
} else {
  const { error } = await db.rpc("admin_set_workspace_access", {
    p_actor_user_id: profile.id,
    p_target_user_id: targetId,
    p_blocked: blocked,
    p_request_id: requestId,
  });
  if (error)
    throw new Error(
      "The access change failed. Apply the workspace export-only migration before retrying.",
    );
  console.log(
    blocked
      ? "Workspace blocked; authenticated data download remains available."
      : "Normal workspace access restored.",
  );
}

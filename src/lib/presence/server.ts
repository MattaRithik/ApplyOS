import "server-only";
import { isIP } from "node:net";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { PAGE_SECTIONS } from "./shared";

export const heartbeatSchema = z.object({
  sessionId: z.uuid(),
  page: z.enum(PAGE_SECTIONS),
  visible: z.boolean(),
  closed: z.boolean(),
  idleSeconds: z.number().int().min(0).max(86400),
}).strict();

export function connectionDetails(request: Request) {
  // Only trust headers injected by the configured hosting platform.
  // Self-hosted/local requests have unknown network details by default.
  const onVercel = process.env.VERCEL === "1";
  const rawIp = onVercel ? request.headers.get("x-vercel-forwarded-for")?.trim() : null;
  const parts = onVercel ? ["x-vercel-ip-city", "x-vercel-ip-country-region", "x-vercel-ip-country"].map((name) => {
    try { return decodeURIComponent(request.headers.get(name) ?? "").slice(0, 100); }
    catch { return ""; }
  }).filter(Boolean) : [];
  return {
    ip_address: rawIp && isIP(rawIp) ? rawIp : null,
    location: parts.length ? parts.join(", ") : null,
    user_agent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
  };
}

export async function prunePresence() {
  const { error } = await createServiceRoleClient().from("user_presence")
    .delete().lt("last_seen_at", new Date(Date.now() - 86400_000).toISOString());
  if (error) throw new Error("Presence cleanup failed.");
}

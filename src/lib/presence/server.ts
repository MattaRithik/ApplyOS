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

function validIp(value: string | null | undefined): string | null {
  const ip = value?.trim();
  if (!ip || !isIP(ip)) return null;
  // Node often represents IPv4 connections using an IPv6-mapped address.
  if (ip.toLowerCase().startsWith("::ffff:") && isIP(ip.slice(7)) === 4) return ip.slice(7);
  return ip;
}

export function connectionDetails(request: Request, remoteAddress?: string) {
  const onVercel = process.env.VERCEL === "1";
  // Vercel overwrites these headers at its edge. Elsewhere use the actual
  // Node socket peer, never arbitrary client-supplied forwarding headers.
  const ip = onVercel
    ? validIp(request.headers.get("x-vercel-forwarded-for"))
      ?? validIp(request.headers.get("x-real-ip"))
      ?? validIp(request.headers.get("x-forwarded-for"))
    : validIp(remoteAddress);
  const parts = onVercel ? ["x-vercel-ip-city", "x-vercel-ip-country-region", "x-vercel-ip-country"].map((name) => {
    try { return decodeURIComponent(request.headers.get(name) ?? "").slice(0, 100); }
    catch { return ""; }
  }).filter(Boolean) : [];
  return {
    ip_address: ip,
    location: parts.length ? parts.join(", ") : null,
    user_agent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
  };
}

export async function prunePresence() {
  const { error } = await createServiceRoleClient().from("user_presence")
    .delete().lt("last_seen_at", new Date(Date.now() - 86400_000).toISOString());
  if (error) throw new Error("Presence cleanup failed.");
}

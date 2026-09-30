import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { AdminAuthError, requireAuthenticatedUser } from "@/lib/admin/roles";
import { isSameOriginMutation, readJsonBody } from "@/lib/security/request";
import { consumeApiRateLimit } from "@/lib/security/rate-limit";
import { connectionDetails, heartbeatSchema, prunePresence } from "@/lib/presence/server";

const headers = { "Cache-Control": "private, no-store" };
export async function recordHeartbeat(request: Request, remoteAddress?: string, sessionClient?: SupabaseClient) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403, headers });
  try {
    const user = await requireAuthenticatedUser(sessionClient ?? await createClient());
    const body = await readJsonBody(request, 2048);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers });
    const parsed = heartbeatSchema.safeParse(body.value);
    if (!parsed.success) return NextResponse.json({ error: "Invalid heartbeat." }, { status: 400, headers });
    if (!await consumeApiRateLimit(user.id, "presence", 60, 60)) {
      return NextResponse.json({ error: "Too many heartbeats." }, { status: 429, headers });
    }
    const now = Date.now();
    await prunePresence();
    const { error } = await createServiceRoleClient().from("user_presence").upsert({
      user_id: user.id,
      email: user.email ?? null,
      session_id: parsed.data.sessionId,
      page: parsed.data.page,
      visible: parsed.data.visible,
      closed: parsed.data.closed,
      last_seen_at: new Date(now).toISOString(),
      last_active_at: new Date(now - parsed.data.idleSeconds * 1000).toISOString(),
      ...connectionDetails(request, remoteAddress),
    }, { onConflict: "user_id,session_id" });
    if (error) throw new Error("Presence write failed.");
    return new NextResponse(null, { status: 204, headers });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    return NextResponse.json({ error: "Activity service unavailable." }, { status: 503, headers });
  }
}

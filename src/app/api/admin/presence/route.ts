import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requirePrimaryOwner, AdminAuthError } from "@/lib/admin/roles";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    await requirePrimaryOwner(await createClient());
    const { data, error } = await createServiceRoleClient().from("user_presence")
      .select("user_id, session_id, email, page, visible, closed, last_seen_at, last_active_at, ip_address, location, user_agent")
      .order("last_seen_at", { ascending: false }).limit(200);
    if (error) throw new Error("Presence read failed.");
    return NextResponse.json({ sessions: data ?? [], serverTime: new Date().toISOString() }, { headers });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    return NextResponse.json({ error: "Unable to load activity. Check the presence database migration." }, { status: 503, headers });
  }
}

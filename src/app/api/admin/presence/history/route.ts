import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requirePrimaryOwner, AdminAuthError } from "@/lib/admin/roles";

const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  try {
    await requirePrimaryOwner(await createClient());
    const before = new URL(request.url).searchParams.get("before");
    if (before !== null && (!/^\d+$/.test(before) || !Number.isSafeInteger(Number(before)) || Number(before) < 1)) {
      return NextResponse.json({ error: "Invalid history cursor." }, { status: 400, headers });
    }
    let query = createServiceRoleClient().from("user_presence_history")
      .select("id, user_id, session_id, email, page, status, recorded_at")
      .order("id", { ascending: false }).limit(101);
    if (before) query = query.lt("id", before);
    const { data, error } = await query;
    if (error) throw new Error("History read failed.");
    const events = (data ?? []).slice(0, 100);
    return NextResponse.json({ events, nextCursor: (data?.length ?? 0) > 100 ? String(events.at(-1)!.id) : null }, { headers });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    return NextResponse.json({ error: "Unable to load activity history. Check the presence history database migration." }, { status: 503, headers });
  }
}

import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requirePrimaryOwner, AdminAuthError } from "@/lib/admin/roles";
import { withProfileNames } from "@/lib/presence/profiles";
import { withVisitActivity } from "@/lib/presence/visit-activity";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  try {
    const owner = await requirePrimaryOwner(await createClient());
    const before = new URL(request.url).searchParams.get("before");
    if (before !== null && (!/^\d+$/.test(before) || !Number.isSafeInteger(Number(before)) || Number(before) < 1)) {
      return NextResponse.json({ error: "Invalid usage cursor." }, { status: 400, headers });
    }
    const db = createServiceRoleClient();
    let query = db.from("user_page_visits")
      .select("id, user_id, page, started_at, last_report_at, visible_seconds, active_seconds")
      .neq("user_id", owner.id).order("id", { ascending: false }).limit(101);
    if (before) query = query.lt("id", before);
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const [visits, summary] = await Promise.all([
      query,
      db.rpc("page_usage_summary", { since_at: since, excluded_user: owner.id }),
    ]);
    if (visits.error || summary.error) throw new Error("Usage read failed.");
    const rows = await withProfileNames(await withVisitActivity(db, (visits.data ?? []).slice(0, 100)));
    return NextResponse.json({ visits: rows, summary: await withProfileNames(summary.data ?? []), since,
      nextCursor: (visits.data?.length ?? 0) > 100 ? String(rows.at(-1)!.id) : null }, { headers });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    return NextResponse.json({ error: "Unable to load page usage. Check the page usage database migration." }, { status: 503, headers });
  }
}

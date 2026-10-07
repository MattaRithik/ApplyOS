import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requirePrimaryOwner, AdminAuthError } from "@/lib/admin/roles";
import { withProfileNames } from "@/lib/presence/profiles";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  try {
    await requirePrimaryOwner(await createClient());
    const page = Number(new URL(request.url).searchParams.get("page") ?? 0);
    if (!Number.isSafeInteger(page) || page < 0 || page > 100000) return NextResponse.json({ error: "Invalid page." }, { status: 400, headers });
    const { data, error, count } = await createServiceRoleClient().from("download_activity")
      .select("id, user_id, kind, file_name, created_at", { count: "exact" })
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(page * 25, page * 25 + 24);
    if (error) throw error;
    return NextResponse.json({ entries: await withProfileNames(data ?? []), total: count ?? 0 }, { headers });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    return NextResponse.json({ error: "Unable to load download activity." }, { status: 503, headers });
  }
}

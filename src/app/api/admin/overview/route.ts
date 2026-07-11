import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireOwner, AdminAuthError } from "@/lib/admin/roles";
import { getOverview } from "@/lib/admin/users";

export async function GET() {
  const supabase = await createClient();
  try {
    await requireOwner(supabase);
  } catch (err) {
    if (err instanceof AdminAuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Authorization check failed." }, { status: 503 });
  }

  try {
    const overview = await getOverview();
    return NextResponse.json(overview);
  } catch {
    return NextResponse.json({ error: "Failed to load administration overview." }, { status: 500 });
  }
}

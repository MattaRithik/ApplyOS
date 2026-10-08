import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requirePrimaryOwner, AdminAuthError } from "@/lib/admin/roles";

import { withProfileNames } from "@/lib/presence/profiles";

const headers = { "Cache-Control": "private, no-store" };
const cursorSchema = z.object({
  at: z.string().datetime({ offset: true }),
  id: z.string().regex(/^(action:\d+|(?:parse|download):[0-9a-f-]{36})$/),
}).strict();
export async function GET(request: Request) {
  try {
    const owner = await requirePrimaryOwner(await createClient());
    const before = new URL(request.url).searchParams.get("before");
    let cursor: z.infer<typeof cursorSchema> | null = null;
    if (before !== null) {
      try {
        if (before.length > 256) throw new Error("Cursor too long.");
        cursor = cursorSchema.parse(JSON.parse(Buffer.from(before, "base64url").toString("utf8")));
      } catch {
        return NextResponse.json({ error: "Invalid history cursor." }, { status: 400, headers });
      }
    }
    const { data, error } = await createServiceRoleClient().rpc("meaningful_activity", {
      excluded_user: owner.id, before_at: cursor?.at ?? null, before_key: cursor?.id ?? null, page_size: 101,
    });
    if (error) throw new Error("History read failed.");
    const rows = (data ?? []) as { id: string; user_id: string; page: string; status: string; recorded_at: string }[];
    const events = await withProfileNames(rows.slice(0, 100));
    const last = events.at(-1);
    return NextResponse.json({ events, nextCursor: (data?.length ?? 0) > 100 && last
      ? Buffer.from(JSON.stringify({ at: last.recorded_at, id: last.id })).toString("base64url") : null }, { headers });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    return NextResponse.json({ error: "Unable to load activity history. Check the presence history database migration." }, { status: 503, headers });
  }
}

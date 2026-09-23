import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOwner, AdminAuthError } from "@/lib/admin/roles";
import { getUserActivity } from "@/lib/admin/user-activity";
import { recordAuditEvent } from "@/lib/admin/audit";

const querySchema = z.object({
  kind: z.enum(["applications", "parsing"]).default("applications"),
  page: z.coerce.number().int().min(0).max(100_000).default(0),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  company: z.string().trim().max(200).default(""),
}).strict();
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const supabase = await createClient();
  let owner;
  try {
    owner = await requireOwner(supabase);
  } catch (err) {
    if (err instanceof AdminAuthError) return NextResponse.json({ error: err.message }, { status: err.status, headers });
    return NextResponse.json({ error: "Authorization check failed." }, { status: 503, headers });
  }

  const id = z.string().uuid().safeParse((await params).userId);
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!id.success || !query.success) return NextResponse.json({ error: "Invalid activity request." }, { status: 400, headers });

  try {
    const { kind, page, pageSize, company } = query.data;
    const activity = await getUserActivity(id.data, kind, page, pageSize, company);
    if (!activity) return NextResponse.json({ error: "User not found." }, { status: 404, headers });
    await recordAuditEvent({
      actorUserId: owner.id,
      targetUserId: id.data,
      actionType: kind === "applications" ? "user_applications_viewed" : "user_parsing_viewed",
      metadata: { page, pageSize, records: activity.entries.length },
      requestId: randomUUID(),
    });
    return NextResponse.json(activity, { headers });
  } catch {
    return NextResponse.json({ error: "Unable to load user activity. Check the database migration and try again." }, { status: 503, headers });
  }
}

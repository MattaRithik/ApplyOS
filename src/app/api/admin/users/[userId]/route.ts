import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOwner, AdminAuthError } from "@/lib/admin/roles";
import { getUserDetail } from "@/lib/admin/users";
import { randomUUID } from "node:crypto";
import { deleteDisabledUser } from "@/lib/admin/delete-user";
import { isSameOriginMutation, readJsonBody } from "@/lib/security/request";
import { consumeApiRateLimit } from "@/lib/security/rate-limit";

const uuidSchema = z.string().uuid();
const deleteSchema = z.strictObject({
  confirm: z.literal(true),
  acknowledgeDataLoss: z.literal(true),
  confirmation: z.string().trim().min(1).max(320),
});

export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  }
  const parsedId = uuidSchema.safeParse((await params).userId);
  if (!parsedId.success) return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  const supabase = await createClient();
  let owner;
  try {
    owner = await requireOwner(supabase);
  } catch (err) {
    if (err instanceof AdminAuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Authorization check failed." }, { status: 503 });
  }
  if (!(await consumeApiRateLimit(owner.id, "admin_mutation", 60, 30))) {
    return NextResponse.json({ error: "Administrative rate limit reached." }, { status: 429 });
  }
  const json = await readJsonBody(request, 4 * 1024);
  if (!json.ok) return NextResponse.json({ error: json.error }, { status: json.status });
  const body = deleteSchema.safeParse(json.value);
  if (!body.success) return NextResponse.json({ error: "Complete both deletion confirmations." }, { status: 400 });
  try {
    const result = await deleteDisabledUser({ actorUserId: owner.id, targetUserId: parsedId.data,
      confirmation: body.data.confirmation, requestId: randomUUID() });
    return NextResponse.json(result, { status: result.ok ? 200 : result.status });
  } catch {
    return NextResponse.json({ error: "Account deletion could not be completed. Refresh the user list before retrying." }, { status: 500 });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const parsedId = uuidSchema.safeParse(userId);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  const supabase = await createClient();
  try {
    await requireOwner(supabase);
  } catch (err) {
    if (err instanceof AdminAuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Authorization check failed." }, { status: 503 });
  }

  const detail = await getUserDetail(parsedId.data).catch(() => null);
  if (!detail) return NextResponse.json({ error: "User not found." }, { status: 404 });

  return NextResponse.json(detail);
}

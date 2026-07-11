import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOwner, AdminAuthError } from "@/lib/admin/roles";
import { getUserDetail } from "@/lib/admin/users";
import { checkRecentActionRate } from "@/lib/admin/audit";
import { sendPasswordResetForUser, revokeSessionsForUser, disableUser, enableUser } from "@/lib/admin/security";
import { isSameOriginMutation, readJsonBody } from "@/lib/security/request";
import { consumeApiRateLimit } from "@/lib/security/rate-limit";

const uuidSchema = z.string().uuid();

const bodySchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("send_password_reset"), confirm: z.literal(true) }),
  z.strictObject({ action: z.literal("revoke_sessions"), confirm: z.literal(true) }),
  z.strictObject({ action: z.literal("disable"), confirm: z.literal(true) }),
  z.strictObject({ action: z.literal("enable") }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  }
  const { userId } = await params;
  const parsedId = uuidSchema.safeParse(userId);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }
  const targetUserId = parsedId.data;

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

  const existing = await getUserDetail(targetUserId);
  if (!existing) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const json = await readJsonBody(request, 4 * 1024);
  if (!json.ok) return NextResponse.json({ error: json.error }, { status: json.status });
  const parsedBody = bodySchema.safeParse(json.value);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const body = parsedBody.data;

  if (existing.role === "owner" && body.action === "disable") {
    return NextResponse.json({ error: "The permanent owner account cannot be disabled." }, { status: 400 });
  }

  const requestId = randomUUID();
  const actorParams = { actorUserId: owner.id, targetUserId, requestId };

  if (body.action === "send_password_reset") {
    const allowed = await checkRecentActionRate("password_reset_sent", targetUserId, { windowMinutes: 5, maxCount: 1 });
    if (!allowed) {
      return NextResponse.json({ error: "A reset email was already sent recently. Try again later." }, { status: 429 });
    }
  }

  let result;
  try {
  switch (body.action) {
    case "send_password_reset":
      result = await sendPasswordResetForUser(actorParams);
      break;
    case "revoke_sessions":
      result = await revokeSessionsForUser(actorParams);
      break;
    case "disable":
      result = await disableUser(actorParams);
      break;
    case "enable":
      result = await enableUser(actorParams);
      break;
  }
  } catch {
    return NextResponse.json({ error: "Administrative action failed." }, { status: 500 });
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Action failed." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

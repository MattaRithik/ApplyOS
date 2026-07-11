import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOwner, AdminAuthError } from "@/lib/admin/roles";
import { getUserDetail } from "@/lib/admin/users";
import { checkRecentActionRate } from "@/lib/admin/audit";
import { grantAIAccess, revokeAIAccess, suspendAIAccess, reactivateAIAccess, updateAILimits } from "@/lib/admin/entitlements";
import { isSameOriginMutation, readJsonBody } from "@/lib/security/request";
import { consumeApiRateLimit } from "@/lib/security/rate-limit";

const uuidSchema = z.string().uuid();

const bodySchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("grant") }),
  z.strictObject({ action: z.literal("revoke"), confirm: z.literal(true) }),
  z.strictObject({ action: z.literal("suspend"), confirm: z.literal(true), reason: z.string().trim().min(1).max(500).optional() }),
  z.strictObject({ action: z.literal("reactivate") }),
  z.strictObject({
    action: z.literal("update_limits"),
    dailyRequestLimit: z.number().int().positive().max(10_000).nullable().optional(),
    monthlyBudgetUsd: z.number().nonnegative().max(10_000).nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
  }),
]);

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
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

  const json = await readJsonBody(request, 8 * 1024);
  if (!json.ok) return NextResponse.json({ error: json.error }, { status: json.status });
  const parsedBody = bodySchema.safeParse(json.value);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const body = parsedBody.data;

  if (existing.role === "owner" && (body.action === "revoke" || body.action === "suspend")) {
    return NextResponse.json({ error: "The permanent owner entitlement cannot be revoked or suspended." }, { status: 400 });
  }

  const requestId = randomUUID();
  const actorParams = { actorUserId: owner.id, targetUserId, requestId };

  try {
  switch (body.action) {
    case "grant":
      await grantAIAccess(actorParams);
      break;
    case "revoke":
      await revokeAIAccess(actorParams);
      break;
    case "suspend": {
      const allowed = await checkRecentActionRate("ai_access_suspended", targetUserId, { windowMinutes: 1, maxCount: 5 });
      if (!allowed) {
        return NextResponse.json({ error: "Too many suspend attempts. Try again shortly." }, { status: 429 });
      }
      await suspendAIAccess({ ...actorParams, reason: body.reason });
      break;
    }
    case "reactivate":
      await reactivateAIAccess(actorParams);
      break;
    case "update_limits":
      await updateAILimits({
        ...actorParams,
        dailyRequestLimit: body.dailyRequestLimit,
        monthlyBudgetUsd: body.monthlyBudgetUsd,
        expiresAt: body.expiresAt,
      });
      break;
  }

  } catch {
    return NextResponse.json({ error: "Failed to update AI access." }, { status: 500 });
  }

  const updated = await getUserDetail(targetUserId).catch(() => null);
  return NextResponse.json({ user: updated });
}

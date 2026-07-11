import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAIParserAccess, ParserAuthError } from "@/lib/ai-parser/entitlement";
import { getUsageSummary, type UsageRange } from "@/lib/ai-parser/usage";
import { z } from "zod";

const rangeSchema = z.enum(["today", "7d", "month", "30d", "all"]);

export async function GET(request: Request) {
  const supabase = await createClient();

  let user, entitlement, limits;
  try {
    ({ user, entitlement, limits } = await requireAIParserAccess(supabase));
  } catch (err) {
    if (err instanceof ParserAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Authorization check failed." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const rangeParam = searchParams.get("range");
  const parsedRange = rangeSchema.safeParse(rangeParam ?? "month");
  if (!parsedRange.success) return NextResponse.json({ error: "Invalid usage range." }, { status: 400 });
  const range: UsageRange = parsedRange.data;

  let summary;
  try {
    summary = await getUsageSummary(user.id, range);
  } catch {
    return NextResponse.json({ error: "Failed to load usage." }, { status: 500 });
  }
  return NextResponse.json({
    ...summary,
    entitlement: {
      dailyRequestLimit: limits.dailyRequestLimit,
      monthlyBudgetUsd: limits.monthlyBudgetUsd,
      expiresAt: entitlement.expiresAt,
    },
  });
}

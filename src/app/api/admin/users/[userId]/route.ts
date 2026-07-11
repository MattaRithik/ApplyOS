import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOwner, AdminAuthError } from "@/lib/admin/roles";
import { getUserDetail } from "@/lib/admin/users";

const uuidSchema = z.string().uuid();

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

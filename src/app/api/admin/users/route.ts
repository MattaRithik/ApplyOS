import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOwner, AdminAuthError } from "@/lib/admin/roles";
import { listUsers } from "@/lib/admin/users";

const MAX_PAGE_SIZE = 100;

const querySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  try {
    await requireOwner(supabase);
  } catch (err) {
    if (err instanceof AdminAuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Authorization check failed." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    search: searchParams.get("search") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query." }, { status: 400 });
  }

  try {
    const result = await listUsers(parsed.data);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to load users." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isWorkspaceBlocked } from "@/lib/access/workspace";
import { isSameOriginMutation } from "@/lib/security/request";
import { consumeApiRateLimit } from "@/lib/security/rate-limit";
import { collectAccountData, buildAccountWorkbook } from "@/lib/export/account-data";
import { checkArchiveSize, createAccountArchive } from "@/lib/export/account-archive";
import { recordDownload } from "@/lib/admin/downloads";

export const runtime = "nodejs";
export const maxDuration = 300;

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function POST(request: Request) {
  if (!isSameOriginMutation(request))
    return NextResponse.json({ error: "Invalid origin." }, { status: 403, headers });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401, headers });
  if (!isWorkspaceBlocked(user))
    return NextResponse.json(
      { error: "Use the Export Center for an active workspace." },
      { status: 403, headers },
    );
  // This route never accepts a user ID, storage key, file URL, or query scope.
  if (new URL(request.url).search || Number(request.headers.get("content-length") ?? 0) > 0) {
    return NextResponse.json(
      { error: "This download does not accept parameters." },
      { status: 400, headers },
    );
  }
  try {
    if (request.body) {
      const reader = request.body.getReader();
      const { value } = await reader.read();
      void reader.cancel().catch(() => {});
      if (value?.byteLength)
        return NextResponse.json(
          { error: "This download does not accept parameters." },
          { status: 400, headers },
        );
    }
    if (!(await consumeApiRateLimit(user.id, "account_export", 600, 3))) {
      return NextResponse.redirect(new URL("/blocked?error=rate_limit", request.url), 303);
    }
    const snapshot = await collectAccountData(createServiceRoleClient(), user);
    checkArchiveSize(snapshot);
    const workbook = await buildAccountWorkbook(snapshot);
    const filename = `applyos-my-data-${snapshot.createdAt.slice(0, 10)}.zip`;
    await recordDownload(user.id, "export", filename);
    return new Response(createAccountArchive(user.id, snapshot, workbook, request.signal), {
      headers: {
        ...headers,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.redirect(new URL("/blocked?error=download", request.url), 303);
  }
}

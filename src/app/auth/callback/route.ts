import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges a Supabase PKCE `code` (from password-reset / magic-link /
 * email-confirmation redirects) for a real session, setting the session
 * cookies server-side before sending the browser on to its destination.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}

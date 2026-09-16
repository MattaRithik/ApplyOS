import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/auth/callback"];

function isPublicPath(pathname: string): boolean {
  return pathname === "/" || PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = isPublicPath(pathname);

  function finish(nextResponse: NextResponse) {
    // Keep refreshed/cleared session cookies even when authentication redirects.
    if (nextResponse !== response) {
      for (const cookie of response.cookies.getAll()) nextResponse.cookies.set(cookie);
    }
    nextResponse.headers.set("Cache-Control", "private, no-store");
    return nextResponse;
  }

  if (!user && !isPublic) {
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return finish(NextResponse.json({ error: "Not authenticated" }, { status: 401 }));
    }
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return finish(NextResponse.redirect(redirectUrl));
  }

  if (user && pathname === "/login") {
    return finish(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  return finish(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};

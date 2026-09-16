import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auth = vi.hoisted(() => ({ user: null as null | { id: string }, refresh: false }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (cookies: unknown[]) => void } }) => ({
    auth: { getUser: async () => {
      if (auth.refresh) options.cookies.setAll([{ name: "session", value: "refreshed", options: { path: "/", httpOnly: true } }]);
      return { data: { user: auth.user } };
    } },
  }),
}));
import { proxy } from "@/proxy";

describe("authentication proxy", () => {
  beforeEach(() => { auth.user = null; auth.refresh = false; });

  it("returns JSON 401 for anonymous APIs instead of a login HTML redirect", async () => {
    const response = await proxy(new NextRequest("https://applyos.example/api/export?entity=applications"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Not authenticated" });
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("redirects protected pages and preserves refreshed session cookies", async () => {
    auth.refresh = true;
    const response = await proxy(new NextRequest("https://applyos.example/applications"));
    expect(response.headers.get("location")).toBe("https://applyos.example/login?next=%2Fapplications");
    expect(response.cookies.get("session")?.value).toBe("refreshed");
  });

  it("preserves cookies when redirecting an authenticated login", async () => {
    auth.user = { id: "user-a" }; auth.refresh = true;
    const response = await proxy(new NextRequest("https://applyos.example/login"));
    expect(response.headers.get("location")).toBe("https://applyos.example/dashboard");
    expect(response.cookies.get("session")?.value).toBe("refreshed");
  });

  it.each(["/auth/callback?code=test", "/reset-password", "/dashboard"])("prevents caching session responses at %s", async (path) => {
    auth.user = { id: "user-a" };
    const response = await proxy(new NextRequest(`https://applyos.example${path}`));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});

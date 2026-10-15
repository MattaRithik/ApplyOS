import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auth = vi.hoisted(() => ({
  user: null as null | {
    id: string;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  },
  refresh: false,
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: { setAll: (cookies: unknown[]) => void } },
  ) => ({
    auth: {
      getUser: async () => {
        if (auth.refresh)
          options.cookies.setAll([
            { name: "session", value: "refreshed", options: { path: "/", httpOnly: true } },
          ]);
        return { data: { user: auth.user } };
      },
    },
  }),
}));
import { proxy } from "@/proxy";

describe("authentication proxy", () => {
  beforeEach(() => {
    auth.user = null;
    auth.refresh = false;
  });

  it("returns JSON 401 for anonymous APIs instead of a login HTML redirect", async () => {
    const response = await proxy(
      new NextRequest("https://applyos.example/api/export?entity=applications"),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Not authenticated" });
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("serves the public preview image without exposing authenticated pages", async () => {
    expect((await proxy(new NextRequest("https://applyos.example/opengraph-image"))).status).toBe(
      200,
    );
    expect(
      (await proxy(new NextRequest("https://applyos.example/applications/opengraph-image"))).status,
    ).toBe(307);
  });

  it.each([
    "/legal",
    "/privacy",
    "/terms",
    "/cookies",
    "/acceptable-use",
    "/ai-policy",
    "/contact",
  ])("allows anonymous access to the legal document at %s", async (path) => {
    const response = await proxy(new NextRequest(`https://applyos.example${path}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it.each(["/privacy/private", "/terms/api", "/contact/admin", "/api/privacy"])(
    "does not broaden public legal access to %s",
    async (path) => {
      const response = await proxy(new NextRequest(`https://applyos.example${path}`));
      expect(response.status).toBe(path.startsWith("/api/") ? 401 : 307);
    },
  );

  it("redirects protected pages and preserves refreshed session cookies", async () => {
    auth.refresh = true;
    const response = await proxy(new NextRequest("https://applyos.example/applications"));
    expect(response.headers.get("location")).toBe(
      "https://applyos.example/login?next=%2Fapplications",
    );
    expect(response.cookies.get("session")?.value).toBe("refreshed");
  });

  it("preserves cookies when redirecting an authenticated login", async () => {
    auth.user = { id: "user-a" };
    auth.refresh = true;
    const response = await proxy(new NextRequest("https://applyos.example/login"));
    expect(response.headers.get("location")).toBe("https://applyos.example/dashboard");
    expect(response.cookies.get("session")?.value).toBe("refreshed");
  });

  it.each(["/", "/login", "/dashboard", "/applications", "/resumes", "/settings"])(
    "redirects a blocked account from %s to its data-download screen",
    async (path) => {
      auth.user = { id: "blocked", app_metadata: { workspace_access: "export_only" } };
      const response = await proxy(new NextRequest(`https://applyos.example${path}`));
      expect(response.headers.get("location")).toBe("https://applyos.example/blocked");
    },
  );

  it.each(["/api/ai-parser", "/api/resumes/create-upload-url", "/api/admin/users", "/api/export"])(
    "rejects a blocked account's ordinary API request at %s",
    async (path) => {
      auth.user = { id: "blocked", app_metadata: { workspace_access: "export_only" } };
      const response = await proxy(
        new NextRequest(`https://applyos.example${path}`, { method: "POST" }),
      );
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("WORKSPACE_BLOCKED");
    },
  );

  it("permits only the blocked screen, exact export/sign-out endpoints, and legal reads", async () => {
    auth.user = { id: "blocked", app_metadata: { workspace_access: "export_only" } };
    for (const [path, method] of [
      ["/blocked", "GET"],
      ["/privacy", "GET"],
      ["/api/account/export", "POST"],
      ["/api/account/sign-out", "POST"],
    ]) {
      expect(
        (await proxy(new NextRequest(`https://applyos.example${path}`, { method }))).status,
      ).toBe(200);
    }
    for (const path of ["/blocked", "/privacy", "/api/account/export/other"]) {
      expect(
        (await proxy(new NextRequest(`https://applyos.example${path}`, { method: "POST" }))).status,
      ).toBe(403);
    }
  });

  it("does not trust user-editable metadata as an access restriction", async () => {
    auth.user = { id: "active", user_metadata: { workspace_access: "export_only" } };
    expect((await proxy(new NextRequest("https://applyos.example/dashboard"))).status).toBe(200);
  });

  it.each(["/auth/callback?code=test", "/reset-password", "/dashboard"])(
    "prevents caching session responses at %s",
    async (path) => {
      auth.user = { id: "user-a" };
      const response = await proxy(new NextRequest(`https://applyos.example${path}`));
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    },
  );
});

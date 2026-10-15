import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string; app_metadata?: Record<string, unknown> },
  collect: vi.fn(),
  rate: vi.fn(),
  build: vi.fn(),
  archive: vi.fn(),
  service: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: mocks.user } }) } }),
  createServiceRoleClient: mocks.service,
}));
vi.mock("@/lib/security/rate-limit", () => ({ consumeApiRateLimit: mocks.rate }));
vi.mock("@/lib/admin/downloads", () => ({ recordDownload: async () => {} }));
vi.mock("@/lib/export/account-data", () => ({
  collectAccountData: mocks.collect,
  buildAccountWorkbook: mocks.build,
}));
vi.mock("@/lib/export/account-archive", () => ({
  checkArchiveSize: vi.fn(),
  createAccountArchive: mocks.archive,
}));
import { POST } from "./route";
const request = (suffix = "", options: RequestInit = {}) =>
  new Request(`https://app.example/api/account/export${suffix}`, { method: "POST", ...options });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: "self", app_metadata: { workspace_access: "export_only" } };
  mocks.rate.mockResolvedValue(true);
  mocks.service.mockReturnValue({ service: true });
  mocks.collect.mockResolvedValue({ createdAt: "2026-10-13T22:00:00Z", records: {}, resumes: [] });
  mocks.build.mockResolvedValue(new Uint8Array([1]));
  mocks.archive.mockImplementation(
    () =>
      new ReadableStream({
        start(c) {
          c.enqueue(new Uint8Array([80, 75]));
          c.close();
        },
      }),
  );
});

describe("restricted self-service account export", () => {
  it("requires validated sign-in and never creates a privileged client for an anonymous request", async () => {
    mocks.user = null;
    expect((await POST(request())).status).toBe(401);
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("rejects cross-site requests and active-workspace accounts", async () => {
    expect((await POST(request("", { headers: { origin: "https://evil.example" } }))).status).toBe(
      403,
    );
    mocks.user = { id: "self", app_metadata: {} };
    expect((await POST(request())).status).toBe(403);
    expect(mocks.collect).not.toHaveBeenCalled();
  });
  it("rejects user IDs or storage keys supplied in a query or request body", async () => {
    expect((await POST(request("?userId=other"))).status).toBe(400);
    expect((await POST(request("", { body: JSON.stringify({ userId: "other" }) }))).status).toBe(
      400,
    );
    expect(mocks.collect).not.toHaveBeenCalled();
  });
  it("scopes privileged collection to the authenticated account and streams a private ZIP", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.collect).toHaveBeenCalledWith({ service: true }, mocks.user);
    expect(mocks.archive.mock.calls[0][0]).toBe("self");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([80, 75]));
  });
  it("offers a retry screen when rate limited or a source read fails", async () => {
    mocks.rate.mockResolvedValueOnce(false);
    expect((await POST(request())).headers.get("location")).toContain("error=rate_limit");
    expect(mocks.collect).not.toHaveBeenCalled();
    mocks.collect.mockRejectedValueOnce(new Error("private provider details"));
    const response = await POST(request());
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://app.example/blocked?error=download");
  });
});

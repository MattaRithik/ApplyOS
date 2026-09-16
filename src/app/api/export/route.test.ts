import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), limit: vi.fn(), rows: vi.fn(), insert: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser }, from: () => ({ insert: mocks.insert }) }),
}));
vi.mock("@/lib/security/rate-limit", () => ({ consumeApiRateLimit: mocks.limit }));
vi.mock("@/lib/export/fetch-entity", () => ({ fetchEntityRows: mocks.rows, EXPORT_ENTITIES: [] }));
import { GET } from "@/app/api/export/route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-a" } } });
  mocks.limit.mockResolvedValue(true);
  mocks.rows.mockResolvedValue([{ company: "Example" }]);
});

describe("export authorization and abuse limits", () => {
  it("rejects anonymous requests before accessing data or rate limits", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await GET(new Request("https://applyos.example/api/export?entity=applications"))).status).toBe(401);
    expect(mocks.rows).not.toHaveBeenCalled();
    expect(mocks.limit).not.toHaveBeenCalled();
  });

  it("stops rate-limited requests before fetching or generating files", async () => {
    mocks.limit.mockResolvedValue(false);
    const response = await GET(new Request("https://applyos.example/api/export?entity=applications"));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(mocks.rows).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("uses the authenticated user for both the limit and the export query", async () => {
    const response = await GET(new Request("https://applyos.example/api/export?entity=applications&format=csv&user_id=other-user"));
    expect(response.status).toBe(200);
    expect(mocks.limit).toHaveBeenCalledWith("user-a", "export", 60, 5);
    expect(mocks.rows).toHaveBeenCalledWith(expect.anything(), "user-a", "applications");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});

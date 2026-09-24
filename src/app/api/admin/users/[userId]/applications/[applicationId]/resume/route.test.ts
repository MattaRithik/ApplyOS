import { describe, expect, it, vi } from "vitest";

const { createClient, serviceClient, sign } = vi.hoisted(() => ({
  createClient: vi.fn(), serviceClient: vi.fn(), sign: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient, createServiceRoleClient: serviceClient }));
vi.mock("@/lib/storage/b2", () => ({ createResumeDownloadUrl: sign }));
import { GET } from "./route";

describe("retired admin private-data endpoint", () => {
  it("returns a non-cacheable 404 without reading data or signing files, even for an owner", async () => {
    createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) } });
    const response = await GET();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found." });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.has("Location")).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
    expect(serviceClient).not.toHaveBeenCalled();
    expect(sign).not.toHaveBeenCalled();
  });
});

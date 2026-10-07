import { beforeEach, describe, expect, it, vi } from "vitest";
const { insert, service } = vi.hoisted(() => ({ insert: vi.fn(), service: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: service }));
import { recordDownload } from "./downloads";
beforeEach(() => { vi.clearAllMocks(); service.mockReturnValue({ from: () => ({ insert }) }); });
describe("download tracking", () => {
  it("records only user, kind and filename", async () => {
    insert.mockResolvedValue({ error: null });
    await recordDownload("user-1", "resume", "Resume.pdf");
    expect(insert).toHaveBeenCalledWith({ user_id: "user-1", kind: "resume", file_name: "Resume.pdf" });
  });
  it("keeps downloads available when analytics fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    insert.mockRejectedValue(new Error("Unavailable"));
    await expect(recordDownload("user-1", "export", "backup.xlsx")).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("Unable to record download activity.");
    log.mockRestore();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserById = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({ auth: { admin: { getUserById } }, from }),
}));
const { getUserActivity } = await import("./user-activity");

function query(result: { data: unknown[] | null; count?: number; error: unknown }) {
  const builder = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue(result),
    in: vi.fn().mockResolvedValue(result),
  };
  return builder;
}

beforeEach(() => {
  vi.resetAllMocks();
  getUserById.mockResolvedValue({ data: { user: { id: "selected-user" } }, error: null });
});

describe("privileged activity data scoping", () => {
  it("scopes applications to the selected user and returns the exact page including archived records", async () => {
    const applications = query({ data: [{ id: "app-1", is_archived: true }], count: 42, error: null });
    from.mockReturnValue(applications);
    const result = await getUserActivity("selected-user", "applications", 2, 10);
    expect(getUserById).toHaveBeenCalledWith("selected-user");
    expect(from).toHaveBeenCalledWith("applications");
    expect(applications.eq.mock.calls).toEqual([["user_id", "selected-user"]]);
    expect(applications.range).toHaveBeenCalledWith(20, 29);
    expect(result).toEqual({ entries: [{ id: "app-1", is_archived: true, resume: null }], total: 42, page: 2, pageSize: 10 });
  });

  it("reads posting context only for the selected user's paginated usage ids", async () => {
    const usage = query({ data: [{ id: "usage-1", status: "failed" }, { id: "legacy-2", status: "success" }], count: 25, error: null });
    const details = query({ data: [{ usage_id: "usage-1", job_description: "Original posting", job_url: "https://example.com", parsed_result: null }], error: null });
    from.mockImplementation((table) => table === "ai_parser_usage" ? usage : details);
    const result = await getUserActivity("selected-user", "parsing", 1, 10);
    expect(usage.eq).toHaveBeenCalledWith("user_id", "selected-user");
    expect(usage.range).toHaveBeenCalledWith(10, 19);
    expect(details.in).toHaveBeenCalledWith("usage_id", ["usage-1", "legacy-2"]);
    expect(result?.entries[0]).toMatchObject({ status: "failed", job_description: "Original posting" });
    expect(result?.entries[1]).toMatchObject({ job_description: null, job_url: null, parsed_result: null });
  });

  it("loads only resumes linked on this page and belonging to the selected user", async () => {
    const applications = query({ data: [
      { id: "app-1", resume_id: "resume-1" },
      { id: "app-2", resume_id: "missing-or-other-user" },
      { id: "app-3", resume_id: null },
    ], count: 3, error: null });
    const resume = { id: "resume-1", display_name: "Engineering", file_extension: "pdf", status: "uploaded", version_notes: "Version 2" };
    const resumes = query({ data: [resume], error: null });
    from.mockImplementation((table) => table === "applications" ? applications : resumes);
    const result = await getUserActivity("selected-user", "applications", 0, 10);
    expect(resumes.eq).toHaveBeenCalledWith("user_id", "selected-user");
    expect(resumes.in).toHaveBeenCalledWith("id", ["resume-1", "missing-or-other-user"]);
    expect(resumes.select).toHaveBeenCalledWith("id, display_name, file_extension, status, version_notes");
    expect(result?.entries).toEqual([
      { id: "app-1", resume }, { id: "app-2", resume: null }, { id: "app-3", resume: null },
    ]);
  });

  it("reports resume lookup failures instead of presenting linked files as missing", async () => {
    const applications = query({ data: [{ id: "app-1", resume_id: "resume-1" }], count: 1, error: null });
    const resumes = query({ data: null, error: { message: "unavailable" } });
    from.mockImplementation((table) => table === "applications" ? applications : resumes);
    await expect(getUserActivity("selected-user", "applications", 0, 10)).rejects.toThrow("Failed to load application resumes.");
  });

  it("does not query context for empty usage pages", async () => {
    from.mockReturnValue(query({ data: [], count: 0, error: null }));
    expect((await getUserActivity("selected-user", "parsing", 0, 10))?.entries).toEqual([]);
    expect(from.mock.calls).toEqual([["ai_parser_usage"]]);
  });

  it("does not report database failures as an empty history", async () => {
    from.mockReturnValue(query({ data: null, count: 0, error: { message: "unavailable" } }));
    await expect(getUserActivity("selected-user", "applications", 0, 10)).rejects.toThrow();
    await expect(getUserActivity("selected-user", "parsing", 0, 10)).rejects.toThrow();
  });

  it("distinguishes auth service failures from a missing user", async () => {
    getUserById.mockResolvedValueOnce({ data: null, error: { status: 503 } });
    await expect(getUserActivity("selected-user", "applications", 0, 10)).rejects.toThrow();
    getUserById.mockResolvedValueOnce({ data: null, error: { status: 404 } });
    expect(await getUserActivity("selected-user", "applications", 0, 10)).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});

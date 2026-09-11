import { beforeEach, describe, expect, it, vi } from "vitest";

const requireOwner = vi.fn();
const from = vi.fn();
const createServiceRoleClient = vi.fn(() => ({ from }));
const sign = vi.fn();
const assertKey = vi.fn();
const audit = vi.fn();
const rateLimit = vi.fn();
class FakeAdminAuthError extends Error {
  constructor(message: string, public status: 401 | 403) { super(message); }
}
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}), createServiceRoleClient }));
vi.mock("@/lib/admin/roles", () => ({ requireOwner, AdminAuthError: FakeAdminAuthError }));
vi.mock("@/lib/admin/audit", () => ({ recordAuditEvent: audit }));
vi.mock("@/lib/security/rate-limit", () => ({ consumeApiRateLimit: rateLimit }));
vi.mock("@/lib/storage/b2", () => ({ assertResumeObjectKeyOwnership: assertKey, createResumeDownloadUrl: sign }));
const { GET } = await import("./route");
const userId = "11111111-1111-4111-8111-111111111111";
const applicationId = "22222222-2222-4222-8222-222222222222";
const resumeId = "33333333-3333-4333-8333-333333333333";
const key = `users/${userId}/resumes/${resumeId}/files/resume.pdf`;
const applicationQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn() };
const resumeQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn() };
const call = (overrides = {}) => GET(new Request("https://applyos.example/api/admin/resume"), {
  params: Promise.resolve({ userId, applicationId, ...overrides }),
});

beforeEach(() => {
  vi.clearAllMocks();
  requireOwner.mockResolvedValue({ id: "owner" });
  rateLimit.mockResolvedValue(true);
  audit.mockResolvedValue(undefined);
  assertKey.mockReturnValue(undefined);
  sign.mockResolvedValue({ url: "https://signed.example/resume.pdf", expiresIn: 300 });
  from.mockImplementation((table) => table === "applications" ? applicationQuery : resumeQuery);
  applicationQuery.maybeSingle.mockResolvedValue({ data: { resume_id: resumeId }, error: null });
  resumeQuery.maybeSingle.mockResolvedValue({ data: { id: resumeId, storage_key: key, display_name: "Engineering resume", file_extension: "pdf", status: "uploaded" }, error: null });
});

describe("owner application resume access", () => {
  it.each([401, 403] as const)("blocks unauthorized requests (%i) before privileged reads", async (status) => {
    requireOwner.mockRejectedValueOnce(new FakeAdminAuthError("Denied", status));
    expect((await call()).status).toBe(status);
    expect(createServiceRoleClient).not.toHaveBeenCalled();
    expect(sign).not.toHaveBeenCalled();
  });

  it("fails closed when authorization is unavailable", async () => {
    requireOwner.mockRejectedValueOnce(new Error("unavailable"));
    expect((await call()).status).toBe(503);
    expect(from).not.toHaveBeenCalled();
  });

  it.each([{ userId: "invalid" }, { applicationId: "invalid" }])("rejects invalid identifiers", async (params) => {
    expect((await call(params)).status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rate-limits the owner before looking up the file", async () => {
    rateLimit.mockResolvedValueOnce(false);
    expect((await call()).status).toBe(429);
    expect(rateLimit).toHaveBeenCalledWith("owner", "resume_download", 3600, 120);
    expect(from).not.toHaveBeenCalled();
  });

  it("checks both user relationships, audits access, and redirects to an inline PDF", async () => {
    const response = await call();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://signed.example/resume.pdf");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(applicationQuery.eq.mock.calls).toEqual([["id", applicationId], ["user_id", userId]]);
    expect(resumeQuery.eq.mock.calls).toEqual([["id", resumeId], ["user_id", userId]]);
    expect(assertKey).toHaveBeenCalledWith(key, userId);
    expect(sign).toHaveBeenCalledWith(key, "Engineering resume.pdf", "inline", "application/pdf");
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "owner", targetUserId: userId, actionType: "user_application_resume_opened",
      metadata: { applicationId, resumeId },
    }));
  });

  it.each([null, { resume_id: null }])("does not sign for missing applications or unlinked resumes", async (data) => {
    applicationQuery.maybeSingle.mockResolvedValueOnce({ data, error: null });
    expect((await call()).status).toBe(404);
    expect(resumeQuery.maybeSingle).not.toHaveBeenCalled();
    expect(sign).not.toHaveBeenCalled();
  });

  it("does not sign a deleted or other user's resume", async () => {
    resumeQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect((await call()).status).toBe(404);
    expect(sign).not.toHaveBeenCalled();
  });

  it.each(["uploading", "failed"])("does not sign a %s resume", async (status) => {
    resumeQuery.maybeSingle.mockResolvedValueOnce({ data: { status }, error: null });
    expect((await call()).status).toBe(409);
    expect(sign).not.toHaveBeenCalled();
  });

  it("does not sign a mismatched storage key", async () => {
    assertKey.mockImplementationOnce(() => { throw new Error("ownership mismatch"); });
    expect((await call()).status).toBe(503);
    expect(sign).not.toHaveBeenCalled();
  });

  it.each(["application", "resume", "signing", "audit"])("returns no file URL when %s fails", async (failure) => {
    if (failure === "application") applicationQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: {} });
    if (failure === "resume") resumeQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: {} });
    if (failure === "signing") sign.mockRejectedValueOnce(new Error("B2 failure"));
    if (failure === "audit") audit.mockRejectedValueOnce(new Error("Audit failure"));
    const response = await call();
    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).not.toContain("signed.example");
  });
});

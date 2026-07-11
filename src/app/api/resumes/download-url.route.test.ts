import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();
const singleMock = vi.fn();
const createResumeDownloadUrlMock = vi.fn();

function queryBuilder() {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.select = vi.fn(self);
  builder.eq = vi.fn(self);
  builder.single = singleMock;
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock }, from: () => queryBuilder() }),
}));

vi.mock("@/lib/security/rate-limit", () => ({ consumeApiRateLimit: async () => true }));
vi.mock("@/lib/storage/b2", () => ({
  assertResumeObjectKeyOwnership: vi.fn(),
  createResumeDownloadUrl: createResumeDownloadUrlMock,
}));

const { GET } = await import("@/app/api/resumes/[id]/download-url/route");
const RESUME_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

function callGet() {
  return GET(new Request(`https://applyos.example/api/resumes/${RESUME_ID}/download-url`), {
    params: Promise.resolve({ id: RESUME_ID }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  createResumeDownloadUrlMock.mockResolvedValue({ url: "https://signed.example/object", expiresIn: 300 });
});

describe("GET /api/resumes/[id]/download-url", () => {
  it("rejects unauthenticated callers before any storage operation", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const response = await callGet();
    expect(response.status).toBe(401);
    expect(createResumeDownloadUrlMock).not.toHaveBeenCalled();
  });

  it("returns 404 and never signs when the ownership-scoped lookup misses", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-a" } } });
    singleMock.mockResolvedValue({ data: null, error: { message: "not found" } });
    const response = await callGet();
    expect(response.status).toBe(404);
    expect(createResumeDownloadUrlMock).not.toHaveBeenCalled();
  });

  it("signs only an uploaded row returned by the ownership-scoped query", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-a" } } });
    singleMock.mockResolvedValue({
      data: { id: RESUME_ID, storage_key: "users/user-a/resumes/id/file.pdf", display_name: "Resume", file_extension: "pdf", status: "uploaded" },
      error: null,
    });
    const response = await callGet();
    expect(response.status).toBe(200);
    expect(createResumeDownloadUrlMock).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid UUIDs before querying storage", async () => {
    const response = await GET(new Request("https://applyos.example/api/resumes/not-a-uuid/download-url"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    expect(response.status).toBe(400);
    expect(createResumeDownloadUrlMock).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn(), sign: vi.fn() }));
vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  return { ...actual, S3Client: class { send = mocks.send; } };
});
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: mocks.sign }));
import { createResumeUploadUrl, inspectResumeObject } from "@/lib/storage/b2";

beforeEach(() => {
  vi.resetAllMocks();
  for (const name of ["B2_ENDPOINT", "B2_REGION", "B2_KEY_ID", "B2_APPLICATION_KEY", "B2_BUCKET_NAME"])
    vi.stubEnv(name, "test-placeholder");
});

describe("resume upload validation", () => {
  it("binds the upload signature to the declared byte length", async () => {
    mocks.sign.mockResolvedValue("https://storage.example/signed");
    await createResumeUploadUrl("users/a/resumes/b/uploads/file.pdf", "application/pdf", 1234);
    expect(mocks.sign.mock.calls[0][1].input).toMatchObject({ ContentLength: 1234, ContentType: "application/pdf" });
  });

  it("reads the file signature only from the object version whose metadata was inspected", async () => {
    mocks.send.mockResolvedValueOnce({ ContentLength: 1234, ContentType: "application/pdf", ETag: '"version-a"' });
    mocks.send.mockResolvedValueOnce({ Body: { transformToByteArray: async () => new TextEncoder().encode("%PDF-1.7") } });
    expect(await inspectResumeObject("key", "pdf")).toMatchObject({ signatureValid: true, eTag: '"version-a"' });
    expect(mocks.send.mock.calls[1][0].input).toMatchObject({ Range: "bytes=0-7", IfMatch: '"version-a"' });
  });

  it("fails closed when storage cannot identify an object version", async () => {
    mocks.send.mockResolvedValueOnce({ ContentLength: 1234 });
    await expect(inspectResumeObject("key", "pdf")).rejects.toThrow("object version");
    expect(mocks.send).toHaveBeenCalledOnce();
  });

  it("does not accept a signature if the object changes during inspection", async () => {
    mocks.send.mockResolvedValueOnce({ ContentLength: 1234, ETag: '"version-a"' });
    mocks.send.mockRejectedValueOnce({ $metadata: { httpStatusCode: 412 } });
    await expect(inspectResumeObject("key", "pdf")).rejects.toMatchObject({ $metadata: { httpStatusCode: 412 } });
  });
});

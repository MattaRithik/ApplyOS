import { beforeEach, describe, expect, it, vi } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { createAccountArchive, safeArchiveFileName } from "./account-archive";
import type { AccountSnapshot } from "./account-data";

const read = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/b2", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage/b2")>()),
  readResumeObject: read,
}));
const snapshot: AccountSnapshot = {
  createdAt: "2026-10-13T22:00:00Z",
  records: { applications: [{ id: "app-1", company_name: "Example" }] },
  resumes: [
    {
      id: "resume-1",
      original_file_name: "resume.docx",
      storage_key: "users/user-1/resumes/resume-1/files/one.docx",
      status: "uploaded",
      file_size: 3,
    },
    {
      id: "resume-2",
      original_file_name: "resume.docx",
      storage_key: "users/user-1/resumes/resume-2/files/two.docx",
      status: "uploaded",
      file_size: 3,
    },
    {
      id: "resume-3",
      original_file_name: "unfinished.pdf",
      storage_key: "users/user-1/resumes/resume-3/uploads/three.pdf",
      status: "failed",
      file_size: 3,
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  read.mockImplementation(async () =>
    (async function* () {
      yield new Uint8Array([1, 2, 3]);
    })(),
  );
});

describe("account ZIP", () => {
  it("includes every completed original once, retains duplicate names, and lists unfinished uploads", async () => {
    const stream = createAccountArchive(
      "user-1",
      snapshot,
      new Uint8Array([4, 5, 6]),
      new AbortController().signal,
    );
    const files = unzipSync(new Uint8Array(await new Response(stream).arrayBuffer()));
    expect(files["resumes/resume-1/resume.docx"]).toEqual(new Uint8Array([1, 2, 3]));
    expect(files["resumes/resume-2/resume.docx"]).toEqual(new Uint8Array([1, 2, 3]));
    expect(files["Your data.xlsx"]).toEqual(new Uint8Array([4, 5, 6]));
    expect(JSON.parse(strFromU8(files["records.json"])).tables).toEqual(snapshot.records);
    const manifest = JSON.parse(strFromU8(files["resume-manifest.json"]));
    expect(manifest[2]).toMatchObject({ included: false, status: "failed" });
    expect(strFromU8(files["records.json"])).not.toContain("storage_key");
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("aborts the download instead of delivering a valid ZIP that silently omits a missing file", async () => {
    read.mockRejectedValueOnce(new Error("File missing"));
    await expect(
      new Response(
        createAccountArchive("user-1", snapshot, new Uint8Array(), new AbortController().signal),
      ).arrayBuffer(),
    ).rejects.toThrow();
  });

  it("rejects cross-account object keys and sanitizes unsafe file names", async () => {
    const bad = {
      ...snapshot,
      resumes: [
        { ...snapshot.resumes[0], storage_key: "users/someone-else/resumes/private/file.docx" },
      ],
    };
    await expect(
      new Response(
        createAccountArchive("user-1", bad, new Uint8Array(), new AbortController().signal),
      ).arrayBuffer(),
    ).rejects.toThrow();
    expect(read).not.toHaveBeenCalled();
    expect(safeArchiveFileName("../../private\\file.docx")).not.toMatch(/[\\/]/);
  });

  it("cancels without opening resume files when the client stops downloading", async () => {
    const stream = createAccountArchive(
      "user-1",
      snapshot,
      new Uint8Array(),
      new AbortController().signal,
    );
    const reader = stream.getReader();
    await reader.read();
    await reader.cancel();
    expect(read).not.toHaveBeenCalled();
  });
});

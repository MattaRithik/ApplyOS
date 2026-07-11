import { describe, expect, it } from "vitest";
import { assertResumeObjectKeyOwnership, buildFinalResumeObjectKey, buildResumeObjectKey } from "@/lib/storage/b2";

describe("B2 object-key isolation", () => {
  it("separates browser-uploadable temp keys from server-only final keys", () => {
    const temporary = buildResumeObjectKey("user-a", "resume-a", "resume.pdf");
    const final = buildFinalResumeObjectKey("user-a", "resume-a", "resume.pdf");
    expect(temporary).toMatch(/^users\/user-a\/resumes\/resume-a\/uploads\//);
    expect(final).toMatch(/^users\/user-a\/resumes\/resume-a\/files\//);
    expect(temporary).not.toBe(final);
  });

  it("rejects cross-user and traversal keys", () => {
    expect(() => assertResumeObjectKeyOwnership("users/user-a/resumes/resume-a/files/file.pdf", "user-a")).not.toThrow();
    expect(() => assertResumeObjectKeyOwnership("users/user-b/resumes/resume-b/files/file.pdf", "user-a")).toThrow();
    expect(() => assertResumeObjectKeyOwnership("users/user-a/resumes/../user-b/file.pdf", "user-a")).toThrow();
  });
});

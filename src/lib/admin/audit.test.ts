import { describe, expect, it } from "vitest";
import { sanitizeAuditMetadata } from "@/lib/admin/audit";

describe("sanitizeAuditMetadata", () => {
  it("redacts sensitive keys and secret-like values", () => {
    expect(
      sanitizeAuditMetadata({
        action: "grant",
        password: "should-never-appear",
        note: "Bearer very-sensitive-token",
        nested: { token: "not accepted" },
      })
    ).toEqual({ action: "grant", password: "[REDACTED]", note: "[REDACTED]" });
  });
});

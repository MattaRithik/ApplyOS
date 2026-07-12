import { describe, expect, it } from "vitest";
import { safeHttpUrl, safeMailto, formatShortUrl } from "@/lib/utils/url";

describe("safeHttpUrl", () => {
  it("accepts a safe https URL", () => {
    expect(safeHttpUrl("https://boards.greenhouse.io/acme/jobs/12345")).toBe("https://boards.greenhouse.io/acme/jobs/12345");
  });

  it("accepts a safe http URL", () => {
    expect(safeHttpUrl("http://example.com/jobs/1")).toBe("http://example.com/jobs/1");
  });

  it("rejects javascript: URLs", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects data: URLs", () => {
    expect(safeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejects blob: URLs", () => {
    expect(safeHttpUrl("blob:https://example.com/uuid")).toBeNull();
  });

  it("rejects file: URLs", () => {
    expect(safeHttpUrl("file:///etc/passwd")).toBeNull();
  });

  it("rejects chrome: URLs", () => {
    expect(safeHttpUrl("chrome://settings")).toBeNull();
  });

  it("rejects about: URLs", () => {
    expect(safeHttpUrl("about:blank")).toBeNull();
  });

  it("rejects mailto: for a job URL field", () => {
    expect(safeHttpUrl("mailto:someone@example.com")).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(safeHttpUrl("not a url")).toBeNull();
  });

  it("returns null for empty/nullish input", () => {
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
  });
});

describe("formatShortUrl", () => {
  it("strips protocol and www", () => {
    expect(formatShortUrl("https://www.example.com/jobs/1")).toBe("example.com/jobs/1");
  });

  it("leaves the real value untouched — only the display string is shortened", () => {
    const long = "https://boards.greenhouse.io/some-very-long-company-name/jobs/1234567890123456789";
    const short = formatShortUrl(long, 30);
    expect(short.length).toBeLessThanOrEqual(30);
    expect(short).toContain("…");
  });

  it("does not truncate a URL shorter than maxLen", () => {
    expect(formatShortUrl("https://x.co/a", 46)).toBe("x.co/a");
  });
});

describe("safeMailto", () => {
  it("accepts a plausible email address", () => {
    expect(safeMailto("jane@example.com")).toBe("mailto:jane@example.com");
  });

  it("rejects a value with embedded control characters (header injection)", () => {
    expect(safeMailto("jane@example.com\r\nBcc: evil@example.com")).toBeNull();
  });

  it("rejects a non-email string", () => {
    expect(safeMailto("not an email")).toBeNull();
  });
});

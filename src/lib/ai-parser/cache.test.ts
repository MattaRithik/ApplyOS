import { describe, expect, it } from "vitest";
import { normalizeDescription, hashDescription } from "@/lib/ai-parser/cache";

describe("normalizeDescription", () => {
  it("converts CRLF line endings to LF", () => {
    const normalized = normalizeDescription("Line one\r\nLine two\r\nLine three");
    expect(normalized).not.toContain("\r");
    expect(normalized).toBe("Line one\nLine two\nLine three");
  });

  it("collapses 3+ blank lines down to 2", () => {
    const normalized = normalizeDescription("A\n\n\n\n\nB");
    expect(normalized).toBe("A\n\nB");
  });

  it("collapses runs of spaces/tabs but preserves meaningful punctuation", () => {
    const normalized = normalizeDescription("Salary:   $120,000  -  $150,000 (great!)");
    expect(normalized).toBe("Salary: $120,000 - $150,000 (great!)");
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalizeDescription("   hello world   ")).toBe("hello world");
  });
});

describe("hashDescription", () => {
  it("produces identical hashes for identical normalized descriptions", () => {
    const a = normalizeDescription("We are hiring a Software Engineer.\r\n\r\nApply now!");
    const b = normalizeDescription("We are hiring a Software Engineer.\n\nApply now!");
    expect(hashDescription(a)).toBe(hashDescription(b));
  });

  it("produces different hashes for materially different descriptions", () => {
    const a = hashDescription(normalizeDescription("Software Engineer role at Acme Corp."));
    const b = hashDescription(normalizeDescription("Data Scientist role at Beta Inc."));
    expect(a).not.toBe(b);
  });

  it("is a stable, deterministic sha256 hex digest", () => {
    const hash = hashDescription("stable input");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashDescription("stable input")).toBe(hash);
  });
});

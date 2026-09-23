import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeDescription, hashDescription, getCachedResult } from "@/lib/ai-parser/cache";

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

describe("future parser cache identity", () => {
  it("only reads the new prompt version, leaving historical cache results untouched", async () => {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    const supabase = { from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient;
    expect(await getCachedResult(supabase, "user-1", "hash")).toBeNull();
    expect(query.eq).toHaveBeenCalledWith("prompt_version", "2.1.0");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("separates identical text with different posting URLs", () => {
    const text = "A software engineer role at Acme.";
    expect(hashDescription(text, "https://linkedin.com/jobs/view/1")).not.toBe(hashDescription(text, "https://jobs.lever.co/acme/1"));
    expect(hashDescription(text)).not.toBe(hashDescription(text, "https://linkedin.com/jobs/view/1"));
  });
});

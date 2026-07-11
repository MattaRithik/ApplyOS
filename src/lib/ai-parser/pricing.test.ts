import { describe, expect, it } from "vitest";
import { calculateCost, PRICING_TABLE } from "@/lib/ai-parser/pricing";

describe("calculateCost", () => {
  it("computes gpt-5-nano cost correctly with no cached tokens", () => {
    const result = calculateCost({ model: "gpt-5-nano", inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(result.inputCostUsd).toBeCloseTo(0.05, 10);
    expect(result.outputCostUsd).toBeCloseTo(0.4, 10);
    expect(result.cachedInputCostUsd).toBe(0);
    expect(result.totalCostUsd).toBeCloseTo(0.45, 10);
  });

  it("computes gpt-5-mini cost correctly", () => {
    const result = calculateCost({ model: "gpt-5-mini", inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(result.inputCostUsd).toBeCloseTo(0.25, 10);
    expect(result.outputCostUsd).toBeCloseTo(2.0, 10);
    expect(result.totalCostUsd).toBeCloseTo(2.25, 10);
  });

  it("treats cached tokens as a SUBSET of input tokens, not additive", () => {
    // 1,000,000 input tokens, 400,000 of which are cached.
    const result = calculateCost({ model: "gpt-5-nano", inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 400_000 });
    const expectedNonCached = (600_000 / 1_000_000) * PRICING_TABLE["gpt-5-nano"].inputPerMillion;
    const expectedCached = (400_000 / 1_000_000) * PRICING_TABLE["gpt-5-nano"].cachedInputPerMillion;
    expect(result.inputCostUsd).toBeCloseTo(expectedNonCached, 10);
    expect(result.cachedInputCostUsd).toBeCloseTo(expectedCached, 10);
    expect(result.totalCostUsd).toBeCloseTo(expectedNonCached + expectedCached, 10);
    // Sanity: cached-inclusive total must be cheaper than treating all tokens as non-cached input.
    const allNonCached = (1_000_000 / 1_000_000) * PRICING_TABLE["gpt-5-nano"].inputPerMillion;
    expect(result.totalCostUsd).toBeLessThan(allNonCached);
  });

  it("clamps cachedInputTokens that exceed inputTokens rather than producing a negative non-cached count", () => {
    const result = calculateCost({ model: "gpt-5-nano", inputTokens: 100, outputTokens: 0, cachedInputTokens: 500 });
    expect(result.inputCostUsd).toBe(0); // non-cached portion clamped to 0, not negative
  });

  it("retains precision for tiny sub-cent values", () => {
    const result = calculateCost({ model: "gpt-5-nano", inputTokens: 100, outputTokens: 0 });
    // 100 tokens of $0.05/1M input = $0.000005
    expect(result.totalCostUsd).toBeCloseTo(0.000005, 12);
    expect(result.totalCostUsd).toBeGreaterThan(0);
  });

  it("returns zeroed-out costs for an unknown model rather than throwing", () => {
    const result = calculateCost({ model: "some-unknown-model", inputTokens: 1000, outputTokens: 1000 });
    expect(result.totalCostUsd).toBe(0);
    expect(result.pricing).toBeNull();
  });
});

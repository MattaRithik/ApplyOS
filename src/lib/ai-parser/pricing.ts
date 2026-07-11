export interface ModelPricing {
  provider: "openai";
  model: string;
  effectiveDate: string;
  inputPerMillion: number;
  cachedInputPerMillion: number;
  outputPerMillion: number;
  sourceNote: string;
  pricingVersion: string;
}

/**
 * Hardcoded pricing table — this is pricing DATA, not a model-id string,
 * so it's fine to hardcode here even though the model ID used to call the
 * API comes from env (see AI_PARSER_MODEL). The gpt-5-nano entry is kept
 * even though it's no longer the default/primary model — it remains a
 * valid, supported model id an operator could still configure via
 * AI_PARSER_MODEL, and historical usage rows recorded under the old
 * nano-then-mini strategy reference it.
 */
export const PRICING_TABLE: Record<string, ModelPricing> = {
  "gpt-5-nano": {
    provider: "openai",
    model: "gpt-5-nano",
    effectiveDate: "2026-01-01",
    inputPerMillion: 0.05,
    cachedInputPerMillion: 0.005,
    outputPerMillion: 0.4,
    sourceNote: "verified against developers.openai.com/api/docs/models/gpt-5-nano on 2026-07-11",
    pricingVersion: "1.0.0",
  },
  "gpt-5-mini": {
    provider: "openai",
    model: "gpt-5-mini",
    effectiveDate: "2026-01-01",
    inputPerMillion: 0.25,
    cachedInputPerMillion: 0.025,
    outputPerMillion: 2.0,
    sourceNote: "verified against developers.openai.com/api/docs/models/gpt-5-mini on 2026-07-11",
    pricingVersion: "1.0.0",
  },
};

export interface CostCalculationInput {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

export interface CostCalculationResult {
  inputCostUsd: number;
  cachedInputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  pricing: ModelPricing | null;
}

/**
 * Cached tokens are a SUBSET of input tokens per OpenAI's usage semantics
 * (usage.input_tokens_details.cached_tokens) — they must never be added on
 * top of input tokens, only priced differently within them.
 */
export function calculateCost({ model, inputTokens, outputTokens, cachedInputTokens = 0 }: CostCalculationInput): CostCalculationResult {
  const baseModel = model.startsWith("gpt-5-mini-") ? "gpt-5-mini" : model.startsWith("gpt-5-nano-") ? "gpt-5-nano" : model;
  const pricing = PRICING_TABLE[baseModel] ?? null;
  if (!pricing) {
    return { inputCostUsd: 0, cachedInputCostUsd: 0, outputCostUsd: 0, totalCostUsd: 0, pricing: null };
  }

  const cachedTokens = Math.max(0, Math.min(cachedInputTokens, inputTokens));
  const nonCachedInputTokens = inputTokens - cachedTokens;

  const inputCostUsd = (nonCachedInputTokens / 1_000_000) * pricing.inputPerMillion;
  const cachedInputCostUsd = (cachedTokens / 1_000_000) * pricing.cachedInputPerMillion;
  const outputCostUsd = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  const totalCostUsd = inputCostUsd + cachedInputCostUsd + outputCostUsd;

  return { inputCostUsd, cachedInputCostUsd, outputCostUsd, totalCostUsd, pricing };
}

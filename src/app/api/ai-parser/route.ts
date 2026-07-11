import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAIParserAccess, ParserAuthError } from "@/lib/ai-parser/entitlement";
import { parseRequestSchema, PARSER_SCHEMA_VERSION, PROMPT_VERSION, type AiParserResult } from "@/lib/ai-parser/schema";
import { normalizeDescription, hashDescription, getCachedResult, writeCacheResult } from "@/lib/ai-parser/cache";
import { checkMonthlyBudget } from "@/lib/ai-parser/budget";
import { acquireParseSlot, finalizeUsageRow, getRateLimitConfig, type FinalizeUsagePatch } from "@/lib/ai-parser/rate-limit";
import { calculateCost } from "@/lib/ai-parser/pricing";
import { parseJobDescription, ParserProviderError, ParserUnusableResultError } from "@/lib/ai-parser/service";
import { isSameOriginMutation, readJsonBody } from "@/lib/security/request";

export const maxDuration = 60;

const MIN_MEANINGFUL_CHARS = 100;
const DEFAULT_MAX_INPUT_CHARS = 50_000;
const ABSOLUTE_MAX_INPUT_CHARS = 100_000;

function maxInputChars(): number {
  const raw = Number(process.env.AI_PARSER_MAX_INPUT_CHARS);
  return Number.isInteger(raw) && raw > 0 ? Math.min(raw, ABSOLUTE_MAX_INPUT_CHARS) : DEFAULT_MAX_INPUT_CHARS;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = randomUUID();
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  }
  const supabase = await createClient();

  let user, limits;
  try {
    ({ user, limits } = await requireAIParserAccess(supabase));
  } catch (err) {
    if (err instanceof ParserAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Authorization check failed." }, { status: 503 });
  }

  const body = await readJsonBody(request, maxInputChars() * 4 + 8 * 1024);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const parsedRequest = parseRequestSchema.safeParse(body.value);
  if (!parsedRequest.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { jobDescription, jobUrl, forceRefresh } = parsedRequest.data;

  const meaningfulLength = jobDescription.trim().length;
  if (meaningfulLength < MIN_MEANINGFUL_CHARS) {
    return NextResponse.json({ error: "That doesn't look like a full job description yet." }, { status: 400 });
  }
  const limit = maxInputChars();
  if (jobDescription.length > limit) {
    return NextResponse.json({ error: `Job description is too long (max ${limit} characters).` }, { status: 413 });
  }

  const budget = await checkMonthlyBudget(user.id, limits.monthlyBudgetUsd);
  if (!budget.ok) {
    return NextResponse.json({ error: "The monthly AI parsing budget has been reached." }, { status: 429 });
  }

  const slot = await acquireParseSlot(user.id, getRateLimitConfig(limits.dailyRequestLimit));
  if (!slot.ok) {
    return NextResponse.json({ error: "Rate limit reached.", reason: slot.reason }, { status: 429 });
  }
  const usageRowId = slot.usageRowId;
  const finalizeUsageSafely = async (patch: FinalizeUsagePatch) => {
    try {
      await finalizeUsageRow(usageRowId, patch);
    } catch {
      console.error(`[ai-parser] request=${requestId} usage_finalize_failed`);
    }
  };

  const normalized = normalizeDescription(jobDescription);
  const descriptionHash = hashDescription(normalized);

  try {
    if (!forceRefresh) {
      const cached = await getCachedResult(supabase, user.id, descriptionHash);
      if (cached) {
        await finalizeUsageSafely({
          status: "cache_hit",
          cacheHit: true,
          model: cached.model ?? undefined,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedTotalCostUsd: 0,
          latencyMs: Date.now() - startedAt,
          parserSchemaVersion: PARSER_SCHEMA_VERSION,
          promptVersion: PROMPT_VERSION,
          descriptionHash,
          inputCharacters: jobDescription.length,
          requestId,
        });
        return NextResponse.json({
          result: cached.result,
          provenance: cached.result.provenance,
          cacheHit: true,
          modelUsed: cached.model,
          fallbackUsed: cached.result.parseMeta?.fallbackUsed ?? false,
          parserVersion: PARSER_SCHEMA_VERSION,
          descriptionHash,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
        });
      }
    }

    let outcome;
    try {
      outcome = await parseJobDescription({ jobDescription: normalized, jobUrl });
    } catch (err) {
      if (err instanceof ParserProviderError) {
        console.error(`[ai-parser] request=${requestId} provider_error retryable=${err.retryable}`);
        await finalizeUsageSafely({
          status: "failed",
          errorCategory: "provider_network",
          latencyMs: Date.now() - startedAt,
          inputCharacters: jobDescription.length,
          descriptionHash,
          requestId,
        });
        return NextResponse.json({ error: "The AI provider is temporarily unavailable. Please try again." }, { status: 503 });
      }
      if (err instanceof ParserUnusableResultError) {
        console.error(`[ai-parser] request=${requestId} unusable_result`);
        // The provider may have generated (and billed) a response even
        // though it was unusable — record that real cost rather than
        // silently reporting zero tokens for a request that wasn't free.
        const failedAttemptCost = err.usage
          ? calculateCost({
              model: process.env.AI_PARSER_MODEL || "gpt-5-mini",
              inputTokens: err.usage.inputTokens,
              outputTokens: err.usage.outputTokens,
              cachedInputTokens: err.usage.cachedInputTokens,
            })
          : null;
        await finalizeUsageSafely({
          status: "failed",
          errorCategory: "unusable_result",
          latencyMs: Date.now() - startedAt,
          inputCharacters: jobDescription.length,
          descriptionHash,
          requestId,
          ...(err.usage
            ? {
                inputTokens: err.usage.inputTokens,
                outputTokens: err.usage.outputTokens,
                totalTokens: err.usage.totalTokens,
                cachedInputTokens: err.usage.cachedInputTokens,
              }
            : {}),
          ...(failedAttemptCost
            ? {
                estimatedInputCostUsd: failedAttemptCost.inputCostUsd,
                estimatedCachedInputCostUsd: failedAttemptCost.cachedInputCostUsd,
                estimatedOutputCostUsd: failedAttemptCost.outputCostUsd,
                estimatedTotalCostUsd: failedAttemptCost.totalCostUsd,
              }
            : {}),
        });
        return NextResponse.json({ error: "The AI parser couldn't produce a usable result for this posting." }, { status: 502 });
      }
      throw err;
    }

    const { result, usage } = outcome;
    const cost = calculateCost({
      model: result.parseMeta.finalModel,
      inputTokens: usage.totalInputTokens,
      outputTokens: usage.totalOutputTokens,
      cachedInputTokens: usage.totalCachedInputTokens,
    });

    await writeCacheResult(user.id, descriptionHash, result, result.parseMeta.finalModel).catch(() =>
      console.error(`[ai-parser] request=${requestId} cache_write_failed`)
    );

    await finalizeUsageSafely({
      status: "success",
      model: result.parseMeta.finalModel,
      fallbackUsed: result.parseMeta.fallbackUsed,
      initialModel: result.parseMeta.initialModel,
      finalModel: result.parseMeta.finalModel,
      cacheHit: false,
      inputCharacters: jobDescription.length,
      inputTokens: usage.totalInputTokens,
      outputTokens: usage.totalOutputTokens,
      totalTokens: usage.totalTokens,
      cachedInputTokens: usage.totalCachedInputTokens,
      providerRequestCount: usage.modelCalls.length,
      estimatedInputCostUsd: cost.inputCostUsd,
      estimatedCachedInputCostUsd: cost.cachedInputCostUsd,
      estimatedOutputCostUsd: cost.outputCostUsd,
      estimatedTotalCostUsd: cost.totalCostUsd,
      latencyMs: result.parseMeta.latencyMs,
      parserSchemaVersion: PARSER_SCHEMA_VERSION,
      promptVersion: PROMPT_VERSION,
      descriptionHash,
      requestId,
    });

    const response: {
      result: AiParserResult;
      provenance: AiParserResult["provenance"];
      cacheHit: boolean;
      modelUsed: string;
      fallbackUsed: boolean;
      parserVersion: string;
      descriptionHash: string;
      usage: { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number };
    } = {
      result,
      provenance: result.provenance,
      cacheHit: false,
      modelUsed: result.parseMeta.finalModel,
      fallbackUsed: result.parseMeta.fallbackUsed,
      parserVersion: PARSER_SCHEMA_VERSION,
      descriptionHash,
      usage: {
        inputTokens: usage.totalInputTokens,
        outputTokens: usage.totalOutputTokens,
        totalTokens: usage.totalTokens,
        estimatedCostUsd: cost.totalCostUsd,
      },
    };

    return NextResponse.json(response);
  } catch {
    // Log minimally — request id + error category, never the raw
    // description or full provider response.
    console.error(`[ai-parser] request=${requestId} unexpected_error`);
    await finalizeUsageSafely({
      status: "failed",
      errorCategory: "unexpected",
      latencyMs: Date.now() - startedAt,
      inputCharacters: jobDescription.length,
      descriptionHash,
      requestId,
    });
    return NextResponse.json({ error: "Parsing failed. Please try again." }, { status: 500 });
  }
}

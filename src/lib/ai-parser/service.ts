import "server-only";
import { z } from "zod";
import { getOpenAIClient } from "@/lib/ai-parser/client";
import {
  rawAiJobParseSchema,
  PARSER_SCHEMA_VERSION,
  PROMPT_VERSION,
  type AiParserResult,
  type ProvenanceMap,
  type RawAiJobParse,
} from "@/lib/ai-parser/schema";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai-parser/prompt";
import { runDeterministicPass, type DeterministicPartial } from "@/lib/ai-parser/deterministic";

// Single-model strategy: gpt-5-mini is the primary (and only) parser model.
// There is no nano-first / confidence-based fallback to a different model —
// a live comparison showed nano's self-reported confidence landing below
// any reasonable threshold on real postings often enough that the "fallback"
// path was really just "call mini after already paying for nano," doubling
// latency and cost for no accuracy benefit. Model self-reported confidence
// (metadata.overallConfidence) remains in the response as UI-facing
// metadata only — it must never trigger a second provider call.
const configuredModel = process.env.AI_PARSER_MODEL?.trim();
const DEFAULT_MODEL = configuredModel && /^gpt-5-(mini|nano)(?:-\d{4}-\d{2}-\d{2})?$/.test(configuredModel)
  ? configuredModel
  : "gpt-5-mini";
// GPT-5-family models bill hidden "reasoning" tokens as output tokens and
// spend real latency on them. This is a pure single-pass extraction task
// (read text, fill a schema) with no multi-step reasoning to do, so the
// model's default effort (medium) is pure waste here — "low" cuts cost and
// latency substantially with no observed accuracy loss on extraction tasks.
const configuredEffort = process.env.AI_PARSER_REASONING_EFFORT?.trim();
const REASONING_EFFORT: "minimal" | "low" | "medium" | "high" =
  configuredEffort === "minimal" || configuredEffort === "low" || configuredEffort === "medium" || configuredEffort === "high"
    ? configuredEffort
    : "low";
// At most this many EXTRA attempts (beyond the first) against the same
// primary model, and only for the specific retryable conditions checked in
// parseJobDescription below — never for auth/validation/budget/rate-limit
// errors, which are handled (and never reach this module) before a provider
// call is ever made.
const configuredRetries = Number(process.env.AI_PARSER_MAX_RETRIES ?? 1);
const MAX_RETRIES = Number.isInteger(configuredRetries) ? Math.max(0, Math.min(configuredRetries, 1)) : 1;

interface AttemptUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  totalTokens: number;
}

/**
 * Raised when a response fails JSON parsing or Zod schema validation, or
 * when the primary model could not produce a usable result even after the
 * allowed retries (the API route maps the latter to a 502). Carries the
 * provider's reported token usage for the failed attempt when available —
 * a validation failure still means the provider generated (and billed) a
 * response, so that usage must still be counted, not silently dropped.
 */
export class ParserUnusableResultError extends Error {
  usage?: AttemptUsage;
  constructor(message: string, usage?: AttemptUsage) {
    super(message);
    this.name = "ParserUnusableResultError";
    this.usage = usage;
  }
}

/** Raised on network/timeout/provider-side failures. `retryable` signals whether a same-model retry is worthwhile (vs. a request-shape problem that would fail identically again). */
export class ParserProviderError extends Error {
  retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "ParserProviderError";
    this.retryable = retryable;
  }
}

let cachedJsonSchema: Record<string, unknown> | null = null;
function getJsonSchema(): Record<string, unknown> {
  if (!cachedJsonSchema) {
    cachedJsonSchema = z.toJSONSchema(rawAiJobParseSchema) as Record<string, unknown>;
  }
  return cachedJsonSchema;
}

interface ModelCallResult {
  raw: RawAiJobParse;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  totalTokens: number;
}

async function callModel(model: string, systemPrompt: string, userPrompt: string): Promise<ModelCallResult> {
  const client = getOpenAIClient();

  let response;
  try {
    response = await client.responses.create({
      model,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      reasoning: { effort: REASONING_EFFORT },
      text: {
        format: {
          type: "json_schema",
          name: "job_parse_result",
          schema: getJsonSchema(),
          strict: true,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown provider error";
    // Network/timeout errors and 5xx are worth retrying with the fallback
    // model; 4xx (bad request, auth) are not — those indicate a request
    // shape problem that will fail identically on the fallback model too.
    const status = (err as { status?: number })?.status;
    const retryable = typeof status !== "number" || status >= 500;
    throw new ParserProviderError(message, retryable);
  }

  const rawUsage = response.usage as
    | { input_tokens?: number; output_tokens?: number; total_tokens?: number; input_tokens_details?: { cached_tokens?: number } }
    | undefined;
  const attemptUsage: AttemptUsage = {
    inputTokens: rawUsage?.input_tokens ?? 0,
    outputTokens: rawUsage?.output_tokens ?? 0,
    cachedInputTokens: rawUsage?.input_tokens_details?.cached_tokens ?? 0,
    totalTokens: rawUsage?.total_tokens ?? 0,
  };

  const outputText = response.output_text;
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(outputText);
  } catch {
    // The provider still generated (and billed) this response even though
    // it wasn't valid JSON — carry the usage so the caller can still record
    // real cost for this attempt instead of silently dropping it.
    throw new ParserUnusableResultError(`Model ${model} returned non-JSON output.`, attemptUsage);
  }

  const validated = rawAiJobParseSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new ParserUnusableResultError(`Model ${model} returned a response that failed schema validation.`, attemptUsage);
  }

  const usage = rawUsage;

  return {
    raw: validated.data,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cachedInputTokens: usage?.input_tokens_details?.cached_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
  };
}

/** Overlays deterministic values onto the AI-extracted groups — deterministic "explicit" values outrank AI "explicit" values. */
function mergeDeterministic(raw: RawAiJobParse, deterministic: DeterministicPartial): RawAiJobParse {
  const merged: RawAiJobParse = structuredClone(raw);
  if (deterministic.identity) {
    if (deterministic.identity.requisitionId != null) merged.identity.requisitionId = deterministic.identity.requisitionId;
    if (deterministic.identity.recruiterEmail != null) merged.identity.recruiterEmail = deterministic.identity.recruiterEmail;
    if (deterministic.identity.sourcePlatform != null) merged.identity.sourcePlatform = deterministic.identity.sourcePlatform;
  }
  if (deterministic.location?.workplaceType != null) {
    merged.location.workplaceType = deterministic.location.workplaceType;
  }
  if (deterministic.compensation) {
    if (deterministic.compensation.salaryMinimum != null) merged.compensation.salaryMinimum = deterministic.compensation.salaryMinimum;
    if (deterministic.compensation.salaryMaximum != null) merged.compensation.salaryMaximum = deterministic.compensation.salaryMaximum;
    if (deterministic.compensation.salaryCurrency != null) merged.compensation.salaryCurrency = deterministic.compensation.salaryCurrency;
  }
  if (deterministic.roleContent) {
    if (deterministic.roleContent.applicationDeadline != null) merged.roleContent.applicationDeadline = deterministic.roleContent.applicationDeadline;
    if (deterministic.roleContent.postingDate != null) merged.roleContent.postingDate = deterministic.roleContent.postingDate;
  }
  return merged;
}

/** Builds the field-path -> provenance-status map for every AI-facing field, then overlays deterministic entries on top. */
function buildProvenance(merged: RawAiJobParse, deterministicProvenance: ProvenanceMap): ProvenanceMap {
  const provenance: ProvenanceMap = {};
  const inferredSet = new Set(merged.metadata.inferredFields ?? []);
  const uncertainSet = new Set(merged.metadata.uncertainFields ?? []);
  const evidence: Record<string, string> = {};
  for (const entry of merged.metadata.evidence ?? []) {
    if (entry.field && entry.note) evidence[entry.field] = entry.note;
  }

  for (const [groupKey, group] of Object.entries(merged)) {
    if (groupKey === "metadata" || groupKey === "provenance") continue;
    if (typeof group !== "object" || group === null) continue;
    for (const [fieldKey, value] of Object.entries(group as Record<string, unknown>)) {
      const path = `${groupKey}.${fieldKey}`;
      let status: ProvenanceMap[string]["status"];
      if (value === null || (Array.isArray(value) && value.length === 0)) {
        status = "missing";
      } else if (inferredSet.has(path)) {
        status = "inferred";
      } else if (uncertainSet.has(path)) {
        status = "uncertain";
      } else {
        status = "explicit";
      }
      const ev = evidence[path];
      provenance[path] = ev ? { status, evidence: ev } : { status };
    }
  }

  // Deterministic entries always win — they were computed with regex/URL
  // certainty, which outranks the AI's own self-report.
  for (const [path, entry] of Object.entries(deterministicProvenance)) {
    provenance[path] = entry;
  }

  return provenance;
}

export interface ParseJobDescriptionArgs {
  jobDescription: string;
  jobUrl?: string;
}

export interface ParseJobDescriptionOutcome {
  result: AiParserResult;
  usage: {
    modelCalls: { model: string; inputTokens: number; outputTokens: number; cachedInputTokens: number; totalTokens: number }[];
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCachedInputTokens: number;
    totalTokens: number;
  };
}

/**
 * Orchestrates the full parse: deterministic pre-pass -> gpt-5-mini
 * (single primary model, no nano-first / confidence-based fallback to a
 * different model) -> deterministic+AI merge -> provenance map.
 *
 * At most MAX_RETRIES extra attempts are made against the SAME primary
 * model, and only when the failure is one of: a retryable provider error
 * (network/timeout/5xx), strict-structured-output/JSON parse failure, or
 * Zod schema validation failure. A non-retryable provider error (4xx —
 * a request-shape problem that would fail identically again) is thrown
 * immediately with zero retries. `metadata.overallConfidence` is never
 * consulted here — it is UI-facing metadata only.
 */
export async function parseJobDescription({ jobDescription, jobUrl }: ParseJobDescriptionArgs): Promise<ParseJobDescriptionOutcome> {
  const startedAt = Date.now();
  const deterministic = runDeterministicPass(jobDescription, jobUrl);

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(deterministic.cleanedText, jobUrl);

  const modelCalls: ParseJobDescriptionOutcome["usage"]["modelCalls"] = [];
  const primaryModel = DEFAULT_MODEL;

  let finalCall: ModelCallResult | null = null;
  let retryUsed = false;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const call = await callModel(primaryModel, systemPrompt, userPrompt);
      modelCalls.push({ model: primaryModel, inputTokens: call.inputTokens, outputTokens: call.outputTokens, cachedInputTokens: call.cachedInputTokens, totalTokens: call.totalTokens });
      finalCall = call;
      break;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      lastError = error;
      // A ParserUnusableResultError still means the provider generated (and
      // billed) a response — record that real usage even though the
      // attempt failed, so cost tracking never silently drops it.
      if (err instanceof ParserUnusableResultError && err.usage) {
        modelCalls.push({ model: primaryModel, inputTokens: err.usage.inputTokens, outputTokens: err.usage.outputTokens, cachedInputTokens: err.usage.cachedInputTokens, totalTokens: err.usage.totalTokens });
      }
      if (err instanceof ParserProviderError && !err.retryable) {
        throw err; // non-retryable (e.g. bad request/auth) — fails identically again, don't retry
      }
      // Retryable provider error, malformed structured output, or a
      // schema-validation failure (ParserUnusableResultError) — worth one
      // more attempt against the same model, up to MAX_RETRIES.
      if (attempt === MAX_RETRIES) break;
      retryUsed = true;
    }
  }

  if (!finalCall) {
    throw lastError instanceof ParserUnusableResultError
      ? lastError
      : new ParserUnusableResultError(lastError ? `Primary model failed: ${lastError.message}` : "No usable model result was produced.");
  }

  const merged = mergeDeterministic(finalCall.raw, deterministic.partial);
  const provenance = buildProvenance(merged, deterministic.provenance);

  const result: AiParserResult = {
    ...merged,
    provenance,
    parseMeta: {
      modelUsed: primaryModel,
      initialModel: primaryModel,
      finalModel: primaryModel,
      fallbackUsed: retryUsed,
      cached: false,
      parserSchemaVersion: PARSER_SCHEMA_VERSION,
      promptVersion: PROMPT_VERSION,
      latencyMs: Date.now() - startedAt,
    },
  };

  const totalInputTokens = modelCalls.reduce((s, c) => s + c.inputTokens, 0);
  const totalOutputTokens = modelCalls.reduce((s, c) => s + c.outputTokens, 0);
  const totalCachedInputTokens = modelCalls.reduce((s, c) => s + c.cachedInputTokens, 0);
  const totalTokens = modelCalls.reduce((s, c) => s + c.totalTokens, 0);

  return {
    result,
    usage: { modelCalls, totalInputTokens, totalOutputTokens, totalCachedInputTokens, totalTokens },
  };
}

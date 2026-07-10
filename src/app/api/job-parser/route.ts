import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { parseJobDescriptionHeuristic } from "@/lib/parser/heuristic";
import { parseWithHuggingFace, PRIMARY_MODEL, FALLBACK_MODEL } from "@/lib/parser/huggingface";
import { getOrExtractResumeText, compareResumeToJob } from "@/lib/parser/resume-match";
import { detectDuplicateApplication } from "@/lib/parser/duplicate";
import { buildWarnings } from "@/lib/parser/warnings";
import {
  jobIntelligenceResultSchema,
  jobExtractionSchema,
  jobIntelligenceSchema,
  PARSER_VERSION,
  type JobExtraction,
  type JobIntelligence,
  type JobIntelligenceResult,
} from "@/lib/parser/schema";

export const maxDuration = 60;

const MAX_DESCRIPTION_CHARS = 20_000;
const MIN_DESCRIPTION_CHARS = 30;

function hashDescription(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function averageConfidence(extraction: JobExtraction): number {
  const values = Object.values(extraction) as { confidence: number }[];
  if (values.length === 0) return 40;
  return Math.round(values.reduce((sum, f) => sum + f.confidence, 0) / values.length);
}

interface StaticParseResult {
  extraction: JobExtraction;
  intelligence: JobIntelligence;
  tags: string[];
  modelUsed: string;
  source: "ai_7b" | "ai_3b" | "heuristic";
  processingTimeMs: number;
  baseWarningsConfidence: number;
}

async function computeStaticParse(jobDescription: string, jobUrl: string | undefined, startedAt: number): Promise<StaticParseResult> {
  const heuristic = parseJobDescriptionHeuristic(jobDescription, jobUrl);

  let ai: Awaited<ReturnType<typeof parseWithHuggingFace>> = null;
  try {
    ai = await parseWithHuggingFace(jobDescription, jobUrl);
  } catch {
    ai = null; // provider fully down — heuristic-only response below
  }

  let extraction: JobExtraction = heuristic.extraction;
  let intelligence: JobIntelligence = heuristic.intelligence;
  let tags = heuristic.tags;
  let source: StaticParseResult["source"] = "heuristic";
  let modelUsed = "heuristic-v" + PARSER_VERSION;

  if (ai) {
    const mergedExtraction = { ...heuristic.extraction, ...ai.extraction };
    const mergedIntelligence = { ...heuristic.intelligence, ...ai.intelligence };
    // Never trust the merged shape blindly — re-validate before accepting it.
    const extractionCheck = jobExtractionSchema.safeParse(mergedExtraction);
    const intelligenceCheck = jobIntelligenceSchema.safeParse(mergedIntelligence);
    if (extractionCheck.success && intelligenceCheck.success) {
      extraction = extractionCheck.data;
      intelligence = intelligenceCheck.data;
      tags = [...new Set([...heuristic.tags, ...ai.tags])];
      source = ai.modelUsed === PRIMARY_MODEL ? "ai_7b" : ai.modelUsed === FALLBACK_MODEL ? "ai_3b" : "ai_7b";
      modelUsed = ai.modelUsed;
    }
  }

  return {
    extraction,
    intelligence,
    tags,
    modelUsed,
    source,
    processingTimeMs: Date.now() - startedAt,
    baseWarningsConfidence: averageConfidence(extraction),
  };
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const jobUrl = typeof body.jobUrl === "string" && body.jobUrl.trim() ? body.jobUrl.trim() : undefined;
  const resumeId = typeof body.resumeId === "string" && body.resumeId.trim() ? body.resumeId.trim() : undefined;
  const forceRefresh = body.forceRefresh === true;
  const rawDescription = typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";

  if (!rawDescription) {
    return NextResponse.json({ error: "Paste a job description first." }, { status: 400 });
  }
  if (rawDescription.length < MIN_DESCRIPTION_CHARS) {
    return NextResponse.json({ error: "That doesn't look like a full job description yet." }, { status: 400 });
  }

  const truncated = rawDescription.length > MAX_DESCRIPTION_CHARS;
  const jobDescription = truncated ? rawDescription.slice(0, MAX_DESCRIPTION_CHARS) : rawDescription;
  const descriptionHash = hashDescription(jobDescription);

  try {
    // --- Static (description-only) part: cache lookup, else heuristic + AI ---
    let staticPart: StaticParseResult | null = null;
    let cached = false;

    if (!forceRefresh) {
      const { data: cacheRow } = await supabase
        .from("job_parse_cache")
        .select("result, model_used, processing_time_ms")
        .eq("user_id", user.id)
        .eq("description_hash", descriptionHash)
        .maybeSingle();

      if (cacheRow) {
        const cachedResult = cacheRow.result as { extraction: JobExtraction; intelligence: JobIntelligence; tags: string[] };
        staticPart = {
          extraction: cachedResult.extraction,
          intelligence: cachedResult.intelligence,
          tags: cachedResult.tags,
          modelUsed: cacheRow.model_used,
          source: "heuristic", // provenance of the cached call isn't re-derived; "cached" flag carries the real signal
          processingTimeMs: cacheRow.processing_time_ms,
          baseWarningsConfidence: averageConfidence(cachedResult.extraction),
        };
        cached = true;
      }
    }

    if (!staticPart) {
      staticPart = await computeStaticParse(jobDescription, jobUrl, startedAt);
    }

    if (!cached) {
      await supabase.from("job_parse_cache").upsert(
        {
          user_id: user.id,
          description_hash: descriptionHash,
          result: { extraction: staticPart.extraction, intelligence: staticPart.intelligence, tags: staticPart.tags },
          model_used: staticPart.modelUsed,
          parser_version: PARSER_VERSION,
          processing_time_ms: staticPart.processingTimeMs,
          confidence: staticPart.baseWarningsConfidence,
        },
        { onConflict: "user_id,description_hash" }
      );
    }

    // --- Context-dependent parts: always recomputed fresh, never cached ---
    let resumeComparison = null;
    if (resumeId) {
      const resumeText = await getOrExtractResumeText(user.id, resumeId);
      if (resumeText) {
        const keywords = staticPart.extraction.keywords?.value ?? [];
        resumeComparison = compareResumeToJob(resumeText, jobDescription, keywords);
        staticPart.intelligence.resumeMatchPercent = resumeComparison.overallMatchPercent;
        staticPart.intelligence.roleFitScore = Math.round(
          (resumeComparison.overallMatchPercent + resumeComparison.keywordCoveragePercent) / 2
        );
      }
    }

    const duplicate = await detectDuplicateApplication(supabase, user.id, {
      companyName: staticPart.extraction.companyName?.value,
      jobTitle: staticPart.extraction.jobTitle?.value,
      jobUrl,
    });

    const warnings = buildWarnings(staticPart.extraction, resumeComparison, duplicate);
    if (truncated) warnings.unshift("The pasted description was very long and was truncated before processing.");

    const result: JobIntelligenceResult = {
      extraction: staticPart.extraction,
      intelligence: staticPart.intelligence,
      resumeComparison,
      tags: staticPart.tags,
      warnings,
      duplicate,
      meta: {
        modelUsed: staticPart.modelUsed,
        parserVersion: PARSER_VERSION,
        processingTimeMs: staticPart.processingTimeMs,
        descriptionHash,
        source: cached ? "cache" : staticPart.source,
        cached,
        confidenceOverall: staticPart.baseWarningsConfidence,
        datedParsed: new Date().toISOString(),
      },
    };

    const validated = jobIntelligenceResultSchema.safeParse(result);
    if (!validated.success) {
      // Should be unreachable given the checks above, but never return unvalidated shape.
      throw new Error("Result failed schema validation");
    }

    return NextResponse.json(validated.data);
  } catch {
    // Last-resort fallback: pure heuristic, no AI, no cache — cheap and can't fail on valid input.
    try {
      const heuristic = parseJobDescriptionHeuristic(jobDescription, jobUrl);
      const duplicate = await detectDuplicateApplication(supabase, user.id, {
        companyName: heuristic.extraction.companyName?.value,
        jobTitle: heuristic.extraction.jobTitle?.value,
        jobUrl,
      });
      const warnings = buildWarnings(heuristic.extraction, null, duplicate);
      warnings.unshift("AI parsing hit an error — showing best-effort results from the built-in parser.");

      const fallback: JobIntelligenceResult = {
        extraction: heuristic.extraction,
        intelligence: heuristic.intelligence,
        resumeComparison: null,
        tags: heuristic.tags,
        warnings,
        duplicate,
        meta: {
          modelUsed: "heuristic-v" + PARSER_VERSION,
          parserVersion: PARSER_VERSION,
          processingTimeMs: Date.now() - startedAt,
          descriptionHash,
          source: "heuristic",
          cached: false,
          confidenceOverall: averageConfidence(heuristic.extraction),
          datedParsed: new Date().toISOString(),
        },
      };
      return NextResponse.json(fallback);
    } catch {
      return NextResponse.json({ error: "Parsing failed. Please try again." }, { status: 500 });
    }
  }
}

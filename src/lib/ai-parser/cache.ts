import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { PARSER_SCHEMA_VERSION, PROMPT_VERSION, type AiParserResult } from "@/lib/ai-parser/schema";

/** Trims, normalizes line endings, and collapses excess whitespace WITHOUT stripping meaningful punctuation. */
export function normalizeDescription(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function hashDescription(normalizedText: string): string {
  return createHash("sha256").update(normalizedText).digest("hex");
}

interface CacheRow {
  result: AiParserResult;
  model: string | null;
}

/** Scoped by user + description hash + schema/prompt version so a schema/prompt bump never serves stale-shaped results. */
export async function getCachedResult(
  supabase: SupabaseClient,
  userId: string,
  descriptionHash: string
): Promise<CacheRow | null> {
  const { data, error } = await supabase
    .from("ai_parser_cache")
    .select("result, model")
    .eq("user_id", userId)
    .eq("description_hash", descriptionHash)
    .eq("parser_schema_version", PARSER_SCHEMA_VERSION)
    .eq("prompt_version", PROMPT_VERSION)
    .maybeSingle();

  if (error || !data) return null;
  return { result: data.result as AiParserResult, model: data.model as string | null };
}

export async function writeCacheResult(
  userId: string,
  descriptionHash: string,
  result: AiParserResult,
  model: string
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("ai_parser_cache").upsert(
    {
      user_id: userId,
      description_hash: descriptionHash,
      result,
      model,
      parser_schema_version: PARSER_SCHEMA_VERSION,
      prompt_version: PROMPT_VERSION,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,description_hash,parser_schema_version,prompt_version" }
  );
  if (error) throw new Error("Failed to persist parser cache.");
}

import { NextResponse } from "next/server";
import { parseJobDescriptionHeuristic } from "@/lib/parser/heuristic";
import { parseJobDescriptionWithLLM } from "@/lib/parser/llm";
import type { ParsedJobResult } from "@/lib/parser/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const jobDescription = (body?.jobDescription as string | undefined)?.trim();
  const jobUrl = body?.jobUrl as string | undefined;

  if (!jobDescription) {
    return NextResponse.json({ error: "jobDescription is required" }, { status: 400 });
  }

  const heuristic = parseJobDescriptionHeuristic(jobDescription, jobUrl);

  let llm: ParsedJobResult | null = null;
  try {
    llm = await parseJobDescriptionWithLLM(jobDescription, jobUrl);
  } catch {
    llm = null; // fall back silently to the heuristic result
  }

  const merged: ParsedJobResult = { ...heuristic, ...(llm ?? {}) };

  return NextResponse.json({
    result: merged,
    source: llm ? "llm" : "heuristic",
  });
}

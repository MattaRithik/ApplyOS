import Anthropic from "@anthropic-ai/sdk";
import type { ParsedJobResult } from "@/lib/parser/types";

const FIELD_SCHEMA = (valueType: Record<string, unknown>) => ({
  type: "object",
  properties: { value: valueType, confidence: { type: "integer" } },
  required: ["value", "confidence"],
  additionalProperties: false,
});

const STRING_FIELD = FIELD_SCHEMA({ type: "string" });
const NUMBER_FIELD = FIELD_SCHEMA({ type: "number" });
const STRING_ARRAY_FIELD = FIELD_SCHEMA({ type: "array", items: { type: "string" } });

const RESULT_SCHEMA = {
  type: "object",
  properties: {
    company: STRING_FIELD,
    jobTitle: STRING_FIELD,
    roleType: STRING_FIELD,
    location: STRING_FIELD,
    workMode: FIELD_SCHEMA({ type: "string", enum: ["remote", "hybrid", "onsite", ""] }),
    employmentType: FIELD_SCHEMA({
      type: "string",
      enum: ["full_time", "part_time", "internship", "contract", "temporary", ""],
    }),
    salaryRange: STRING_FIELD,
    requiredSkills: STRING_ARRAY_FIELD,
    preferredSkills: STRING_ARRAY_FIELD,
    education: STRING_FIELD,
    yearsExperience: STRING_FIELD,
    visaNotes: STRING_FIELD,
    deadline: STRING_FIELD,
    recruiterInfo: STRING_FIELD,
    keywords: STRING_ARRAY_FIELD,
    jobSummary: STRING_FIELD,
    missingSkills: STRING_ARRAY_FIELD,
    suggestedColdEmailAngle: STRING_FIELD,
    suggestedFollowUpDate: STRING_FIELD,
    priorityScore: NUMBER_FIELD,
  },
  required: [
    "company", "jobTitle", "roleType", "location", "workMode", "employmentType",
    "salaryRange", "requiredSkills", "preferredSkills", "education", "yearsExperience",
    "visaNotes", "deadline", "recruiterInfo", "keywords", "jobSummary", "missingSkills",
    "suggestedColdEmailAngle", "suggestedFollowUpDate", "priorityScore",
  ],
  additionalProperties: false,
};

type RawField<T> = { value: T; confidence: number };
type RawResult = {
  [K in keyof typeof RESULT_SCHEMA.properties]: RawField<unknown>;
};

export async function parseJobDescriptionWithLLM(
  jobDescription: string,
  jobUrl?: string
): Promise<ParsedJobResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    output_config: { format: { type: "json_schema", schema: RESULT_SCHEMA } },
    messages: [
      {
        role: "user",
        content:
          `Extract structured fields from this job posting. For every field, give your best ` +
          `extraction and a confidence score from 0-100 reflecting how certain you are it's correct ` +
          `(use 0 with an empty value/array if the field isn't present in the text at all). ` +
          `workMode and employmentType must be one of the enum values or "" if unknown.\n\n` +
          (jobUrl ? `Job URL: ${jobUrl}\n\n` : "") +
          `Job description:\n${jobDescription.slice(0, 12000)}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  let raw: RawResult;
  try {
    raw = JSON.parse(textBlock.text);
  } catch {
    return null;
  }

  const result: ParsedJobResult = {};
  for (const key of Object.keys(RESULT_SCHEMA.properties) as (keyof RawResult)[]) {
    const field = raw[key];
    if (!field || field.confidence <= 0) continue;
    if (Array.isArray(field.value) && field.value.length === 0) continue;
    if (typeof field.value === "string" && field.value.trim() === "") continue;
    (result as Record<string, unknown>)[key] = field;
  }

  return result;
}

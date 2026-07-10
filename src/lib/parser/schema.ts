import { z } from "zod";

/**
 * Bumped whenever the extraction schema or scoring formulas change in a way
 * that would make previously-cached results stale/incompatible.
 */
export const PARSER_VERSION = "2.0.0";

export const FINANCE_ROLE_CATEGORIES = [
  "Quant Research",
  "Quant Trading",
  "Quant Developer",
  "Risk",
  "Market Risk",
  "Credit Risk",
  "Investment Banking",
  "Equity Research",
  "Fixed Income",
  "Portfolio Management",
  "Data Engineering",
  "Machine Learning",
  "AI",
  "Software Engineering",
  "Trading Systems",
  "Financial Data",
  "Asset Management",
  "Derivatives",
  "Options",
  "Volatility",
  "Crypto",
  "Hedge Fund",
  "Private Equity",
  "Consulting",
  "Operations",
] as const;

export const VISA_STATUS_VALUES = [
  "no_sponsorship",
  "opt_accepted",
  "cpt_accepted",
  "h1b_available",
  "future_possible",
  "requires_existing_auth",
  "not_mentioned",
] as const;

export const DIFFICULTY_VALUES = ["low", "medium", "high", "very_high"] as const;
export const COMPETITION_VALUES = ["low", "medium", "high", "very_high"] as const;
export const FIELD_SOURCE_VALUES = ["ai", "heuristic", "cache"] as const;

const confidence = z.number().min(0).max(100);
const score100 = z.number().min(0).max(100);
const source = z.enum(FIELD_SOURCE_VALUES);

/** A single extracted field: value + how sure we are + who produced it. */
function field<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    value: valueSchema,
    confidence,
    source,
  });
}

const stringField = field(z.string().max(4000));
const stringArrayField = field(z.array(z.string().max(200)).max(60));
const numberField = field(z.number());

export const jobExtractionSchema = z.object({
  companyName: stringField.optional(),
  companyWebsite: stringField.optional(),
  companyLinkedInUrl: stringField.optional(),
  jobTitle: stringField.optional(),
  department: stringField.optional(),
  roleCategory: field(z.enum(FINANCE_ROLE_CATEGORIES)).optional(),
  employmentType: field(z.enum(["full_time", "part_time", "internship", "contract", "temporary"])).optional(),
  workMode: field(z.enum(["remote", "hybrid", "onsite"])).optional(),
  locations: stringArrayField.optional(),
  salaryMin: numberField.optional(),
  salaryMax: numberField.optional(),
  currency: stringField.optional(),
  experience: stringField.optional(),
  education: stringField.optional(),
  requiredSkills: stringArrayField.optional(),
  preferredSkills: stringArrayField.optional(),
  programmingLanguages: stringArrayField.optional(),
  technologies: stringArrayField.optional(),
  financeSkills: stringArrayField.optional(),
  softSkills: stringArrayField.optional(),
  keywords: stringArrayField.optional(),
  responsibilities: stringArrayField.optional(),
  qualifications: stringArrayField.optional(),
  preferredQualifications: stringArrayField.optional(),
  deadline: stringField.optional(),
  jobId: stringField.optional(),
  recruiterName: stringField.optional(),
  recruiterEmail: stringField.optional(),
  jobSummary: stringField.optional(),
  jobBoard: stringField.optional(),
  visaStatus: field(z.enum(VISA_STATUS_VALUES)).optional(),
});
export type JobExtraction = z.infer<typeof jobExtractionSchema>;

export const jobIntelligenceSchema = z.object({
  resumeMatchPercent: score100.optional(),
  missingSkills: z.array(z.string()).max(40).optional(),
  topMatchingSkills: z.array(z.string()).max(20).optional(),
  topMissingKeywords: z.array(z.string()).max(20).optional(),
  estimatedDifficulty: z.enum(DIFFICULTY_VALUES).optional(),
  priorityScore: score100.optional(),
  applicationSuccessScore: score100.optional(),
  successScoreReason: z.string().max(600).optional(),
  suggestedResumeVersion: z.string().max(200).optional(),
  suggestedCoverLetterFocus: z.string().max(600).optional(),
  suggestedColdEmailAngle: z.string().max(600).optional(),
  suggestedLinkedInMessage: z.string().max(600).optional(),
  suggestedInterviewTopics: z.array(z.string()).max(15).optional(),
  suggestedFollowUpDate: z.string().optional(),
  estimatedSalaryConfidence: z.enum(["low", "medium", "high"]).optional(),
  estimatedCompetition: z.enum(COMPETITION_VALUES).optional(),
  companyPrestigeScore: score100.optional(),
  roleFitScore: score100.optional(),
  networkingOpportunityScore: score100.optional(),
});
export type JobIntelligence = z.infer<typeof jobIntelligenceSchema>;

export const resumeComparisonSchema = z.object({
  matchedSkills: z.array(z.string()).max(60),
  missingSkills: z.array(z.string()).max(60),
  missingTechnologies: z.array(z.string()).max(40),
  missingFinanceKnowledge: z.array(z.string()).max(40),
  missingProgrammingLanguages: z.array(z.string()).max(40),
  overallMatchPercent: score100,
  keywordCoveragePercent: score100,
  topResumeStrengths: z.array(z.string()).max(10),
  topResumeWeaknesses: z.array(z.string()).max(10),
  recommendedImprovements: z.array(z.string()).max(10),
});
export type ResumeComparison = z.infer<typeof resumeComparisonSchema>;

export const parserMetaSchema = z.object({
  modelUsed: z.string(),
  parserVersion: z.string(),
  processingTimeMs: z.number().min(0),
  descriptionHash: z.string(),
  source: z.enum(["ai_7b", "ai_3b", "heuristic", "cache"]),
  cached: z.boolean(),
  confidenceOverall: score100,
  datedParsed: z.string(),
});
export type ParserMeta = z.infer<typeof parserMetaSchema>;

export const duplicateInfoSchema = z.object({
  isDuplicate: z.boolean(),
  duplicateApplicationId: z.string().nullable().optional(),
  matchedOn: z.array(z.string()).optional(),
});
export type DuplicateInfo = z.infer<typeof duplicateInfoSchema>;

export const jobIntelligenceResultSchema = z.object({
  extraction: jobExtractionSchema,
  intelligence: jobIntelligenceSchema,
  resumeComparison: resumeComparisonSchema.nullable(),
  tags: z.array(z.string()).max(30),
  warnings: z.array(z.string()).max(20),
  duplicate: duplicateInfoSchema,
  meta: parserMetaSchema,
});
export type JobIntelligenceResult = z.infer<typeof jobIntelligenceResultSchema>;

// ---------------------------------------------------------------------
// Raw AI response shape.
//
// Asking a 7B/3B open model to emit our internal {value,confidence,source}
// wrapper on every field is unreliable in practice. Instead we ask the model
// for plain flat values, validate *that* shape strictly with Zod, and only
// then wrap it into the internal field shape ourselves — the model never
// gets to invent a confidence score or claim a "source".
// ---------------------------------------------------------------------

const rawStringArray = z.array(z.string()).max(60).optional().nullable();

export const rawAiExtractionSchema = z.object({
  companyName: z.string().max(200).optional().nullable(),
  companyWebsite: z.string().max(300).optional().nullable(),
  companyLinkedInUrl: z.string().max(300).optional().nullable(),
  jobTitle: z.string().max(200).optional().nullable(),
  department: z.string().max(200).optional().nullable(),
  roleCategory: z.enum(FINANCE_ROLE_CATEGORIES).optional().nullable(),
  employmentType: z.enum(["full_time", "part_time", "internship", "contract", "temporary"]).optional().nullable(),
  workMode: z.enum(["remote", "hybrid", "onsite"]).optional().nullable(),
  locations: rawStringArray,
  salaryMin: z.number().optional().nullable(),
  salaryMax: z.number().optional().nullable(),
  currency: z.string().max(10).optional().nullable(),
  experience: z.string().max(100).optional().nullable(),
  education: z.string().max(200).optional().nullable(),
  requiredSkills: rawStringArray,
  preferredSkills: rawStringArray,
  programmingLanguages: rawStringArray,
  technologies: rawStringArray,
  financeSkills: rawStringArray,
  softSkills: rawStringArray,
  keywords: rawStringArray,
  responsibilities: rawStringArray,
  qualifications: rawStringArray,
  preferredQualifications: rawStringArray,
  deadline: z.string().max(100).optional().nullable(),
  jobId: z.string().max(100).optional().nullable(),
  recruiterName: z.string().max(200).optional().nullable(),
  recruiterEmail: z.string().max(200).optional().nullable(),
  jobSummary: z.string().max(1000).optional().nullable(),
  jobBoard: z.string().max(100).optional().nullable(),
  visaStatus: z.enum(VISA_STATUS_VALUES).optional().nullable(),
});
export type RawAiExtraction = z.infer<typeof rawAiExtractionSchema>;

export const rawAiIntelligenceSchema = z.object({
  estimatedDifficulty: z.enum(DIFFICULTY_VALUES).optional().nullable(),
  priorityScore: z.number().min(0).max(100).optional().nullable(),
  applicationSuccessScore: z.number().min(0).max(100).optional().nullable(),
  successScoreReason: z.string().max(600).optional().nullable(),
  suggestedResumeVersion: z.string().max(200).optional().nullable(),
  suggestedCoverLetterFocus: z.string().max(600).optional().nullable(),
  suggestedColdEmailAngle: z.string().max(600).optional().nullable(),
  suggestedLinkedInMessage: z.string().max(600).optional().nullable(),
  suggestedInterviewTopics: rawStringArray,
  estimatedSalaryConfidence: z.enum(["low", "medium", "high"]).optional().nullable(),
  estimatedCompetition: z.enum(COMPETITION_VALUES).optional().nullable(),
  companyPrestigeScore: z.number().min(0).max(100).optional().nullable(),
  roleFitScore: z.number().min(0).max(100).optional().nullable(),
  networkingOpportunityScore: z.number().min(0).max(100).optional().nullable(),
});
export type RawAiIntelligence = z.infer<typeof rawAiIntelligenceSchema>;

export const rawAiResponseSchema = z.object({
  extraction: rawAiExtractionSchema.default({}),
  intelligence: rawAiIntelligenceSchema.default({}),
  tags: rawStringArray,
});
export type RawAiResponse = z.infer<typeof rawAiResponseSchema>;

const AI_FIELD_CONFIDENCE: Record<string, number> = {
  companyName: 82, companyWebsite: 60, companyLinkedInUrl: 65, jobTitle: 85,
  department: 60, roleCategory: 75, employmentType: 80, workMode: 80,
  locations: 75, salaryMin: 75, salaryMax: 75, currency: 70, experience: 75,
  education: 70, requiredSkills: 80, preferredSkills: 65, programmingLanguages: 80,
  technologies: 75, financeSkills: 75, softSkills: 60, keywords: 70,
  responsibilities: 70, qualifications: 65, preferredQualifications: 60,
  deadline: 65, jobId: 70, recruiterName: 65, recruiterEmail: 80,
  jobSummary: 65, jobBoard: 70, visaStatus: 70,
};

/** Wraps a validated flat AI response into our internal {value,confidence,source} field shape. */
export function wrapAiExtraction(raw: RawAiExtraction): JobExtraction {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    out[key] = { value, confidence: AI_FIELD_CONFIDENCE[key] ?? 70, source: "ai" };
  }
  return out as JobExtraction;
}

export function wrapAiIntelligence(raw: RawAiIntelligence): JobIntelligence {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    out[key] = value;
  }
  return out as JobIntelligence;
}

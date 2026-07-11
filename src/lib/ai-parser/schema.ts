import { z } from "zod";
import { httpUrlSchema } from "@/lib/validation/common";

/**
 * Bumped whenever the extraction schema shape changes in a way that would
 * make previously-cached results stale/incompatible.
 */
export const PARSER_SCHEMA_VERSION = "1.0.0";
/** Bumped whenever the system/developer prompt text changes meaningfully. */
export const PROMPT_VERSION = "1.0.0";
/** Bumped whenever the primary-model/retry decision logic changes. */
export const MODEL_STRATEGY_VERSION = "2.0.0";

// ---------------------------------------------------------------------
// Raw AI-facing schema.
//
// Built as nested sub-objects (rather than one flat ~90-key object) to
// stay well under structured-outputs per-object property limits and to
// give the review UI natural sections for free. Every field is
// `.nullable()` (never `.optional()`) and every group object is
// `.strict()` — OpenAI's strict structured-outputs mode requires every
// key to be present in `required` with no `additionalProperties`, so the
// model must emit an explicit `null` rather than omit a key.
// ---------------------------------------------------------------------

const nStr = (max = 2000) => z.string().max(max).nullable();
const nNum = z.number().nullable();
const nBool = z.boolean().nullable();
const nStrArray = (max = 60, itemMax = 300) => z.array(z.string().max(itemMax)).max(max).nullable();

export const WORKPLACE_TYPE_VALUES = ["remote", "hybrid", "onsite", "unknown"] as const;
export const RELOCATION_VALUES = ["yes", "no", "unclear", "not_mentioned"] as const;
export const EMPLOYMENT_TYPE_VALUES = [
  "full_time",
  "part_time",
  "internship",
  "contract",
  "temporary",
  "seasonal",
  "apprenticeship",
  "unknown",
] as const;
export const SALARY_PERIOD_VALUES = ["hour", "day", "week", "month", "year", "unknown"] as const;
export const VISA_SPONSORSHIP_VALUES = ["available", "not_available", "unclear", "not_mentioned"] as const;

const identitySchema = z
  .object({
    companyName: nStr(200),
    jobTitle: nStr(200),
    requisitionId: nStr(100),
    sourcePlatform: nStr(100),
    department: nStr(200),
    team: nStr(200),
    industry: nStr(200),
    companyDescription: nStr(2000),
    recruiterName: nStr(200),
    recruiterEmail: nStr(200),
    hiringManagerName: nStr(200),
  })
  .strict();

const locationSchema = z
  .object({
    rawLocation: nStr(500),
    city: nStr(200),
    stateOrRegion: nStr(200),
    country: nStr(200),
    workplaceType: z.enum(WORKPLACE_TYPE_VALUES),
    relocationAvailable: z.enum(RELOCATION_VALUES),
    travelRequirement: nStr(300),
    allowedWorkLocations: nStrArray(60, 200),
  })
  .strict();

const employmentSchema = z
  .object({
    employmentType: z.enum(EMPLOYMENT_TYPE_VALUES),
    seniorityLevel: nStr(100),
    roleCategory: nStr(200),
    roleSubcategory: nStr(200),
    managementRole: nBool,
    internshipTerm: nStr(100),
    expectedStartDate: nStr(100),
  })
  .strict();

const compensationSchema = z
  .object({
    salaryMinimum: nNum,
    salaryMaximum: nNum,
    salaryCurrency: nStr(10),
    salaryPeriod: z.enum(SALARY_PERIOD_VALUES),
    bonusMentioned: nBool,
    equityMentioned: nBool,
    commissionMentioned: nBool,
    compensationIsEstimated: nBool,
    compensationText: nStr(500),
  })
  .strict();

const skillsSchema = z
  .object({
    requiredSkills: nStrArray(60, 200),
    preferredSkills: nStrArray(60, 200),
    programmingLanguages: nStrArray(40, 100),
    frameworks: nStrArray(40, 100),
    libraries: nStrArray(40, 100),
    databases: nStrArray(40, 100),
    cloudPlatforms: nStrArray(40, 100),
    dataTools: nStrArray(40, 100),
    financeTools: nStrArray(40, 100),
    machineLearningTools: nStrArray(40, 100),
    developerTools: nStrArray(40, 100),
    methodologies: nStrArray(40, 100),
    domainKnowledge: nStrArray(40, 200),
    softSkills: nStrArray(40, 100),
    keywords: nStrArray(60, 100),
  })
  .strict();

const experienceEducationSchema = z
  .object({
    minimumYearsExperience: nNum,
    maximumYearsExperience: nNum,
    experienceText: nStr(300),
    educationLevel: nStr(200),
    fieldsOfStudy: nStrArray(20, 200),
    graduateDegreeRequired: nBool,
    certificationsRequired: nStrArray(20, 200),
    certificationsPreferred: nStrArray(20, 200),
  })
  .strict();

const roleContentSchema = z
  .object({
    conciseSummary: nStr(1200),
    responsibilities: nStrArray(40, 400),
    requiredQualifications: nStrArray(40, 400),
    preferredQualifications: nStrArray(40, 400),
    benefits: nStrArray(40, 300),
    interviewProcess: nStr(1000),
    applicationDeadline: nStr(100),
    postingDate: nStr(100),
    schedule: nStr(200),
    shift: nStr(100),
  })
  .strict();

const immigrationSchema = z
  .object({
    visaSponsorship: z.enum(VISA_SPONSORSHIP_VALUES),
    sponsorshipText: nStr(500),
    workAuthorizationRequirement: nStr(500),
    citizenshipRequirement: nStr(300),
    securityClearanceRequirement: nStr(300),
    exportControlRestriction: nStr(300),
    backgroundCheckMentioned: nBool,
  })
  .strict();

const relevanceScore = z.number().min(0).max(100).nullable();

const quantRelevanceSchema = z
  .object({
    quantResearchRelevance: relevanceScore,
    quantTradingRelevance: relevanceScore,
    quantDevelopmentRelevance: relevanceScore,
    dataScienceRelevance: relevanceScore,
    dataEngineeringRelevance: relevanceScore,
    softwareEngineeringRelevance: relevanceScore,
    equityResearchRelevance: relevanceScore,
    riskManagementRelevance: relevanceScore,
    portfolioManagementRelevance: relevanceScore,
    financeRelevance: relevanceScore,
  })
  .strict();

// OpenAI's strict structured-outputs mode doesn't support open-ended
// `z.record()` maps (it errors on the resulting `propertyNames` JSON
// Schema keyword) — an array of {field, note} pairs expresses the same
// "a few important fields -> short evidence snippet" idea with a schema
// shape (fixed properties, no additionalProperties) that strict mode
// actually accepts.
const evidenceEntrySchema = z
  .object({
    field: nStr(100),
    note: nStr(300),
  })
  .strict();

const metadataSchema = z
  .object({
    overallConfidence: z.number().min(0).max(1).nullable(),
    uncertainFields: nStrArray(60, 100),
    warnings: nStrArray(30, 300),
    explicitlyMissingCriticalFields: nStrArray(30, 100),
    inferredFields: nStrArray(60, 100),
    evidence: z.array(evidenceEntrySchema).max(20).nullable(),
  })
  .strict();

export const rawAiJobParseSchema = z
  .object({
    identity: identitySchema,
    location: locationSchema,
    employment: employmentSchema,
    compensation: compensationSchema,
    skills: skillsSchema,
    experienceEducation: experienceEducationSchema,
    roleContent: roleContentSchema,
    immigration: immigrationSchema,
    quantRelevance: quantRelevanceSchema,
    metadata: metadataSchema,
  })
  .strict();

export type RawAiJobParse = z.infer<typeof rawAiJobParseSchema>;
export type IdentityGroup = z.infer<typeof identitySchema>;
export type LocationGroup = z.infer<typeof locationSchema>;
export type EmploymentGroup = z.infer<typeof employmentSchema>;
export type CompensationGroup = z.infer<typeof compensationSchema>;
export type SkillsGroup = z.infer<typeof skillsSchema>;
export type ExperienceEducationGroup = z.infer<typeof experienceEducationSchema>;
export type RoleContentGroup = z.infer<typeof roleContentSchema>;
export type ImmigrationGroup = z.infer<typeof immigrationSchema>;
export type QuantRelevanceGroup = z.infer<typeof quantRelevanceSchema>;
export type MetadataGroup = z.infer<typeof metadataSchema>;

// ---------------------------------------------------------------------
// Provenance.
//
// A separate, internal map — NOT sent to or returned by the raw AI
// schema. Deterministic fields default to "explicit"/"normalized";
// AI fields default to "explicit" unless the model flagged them via
// metadata.inferredFields / metadata.uncertainFields, or the value is
// null ("missing"). Only fields that actually have a value worth
// annotating get an entry — we do not wrap every primitive.
// ---------------------------------------------------------------------

export type FieldProvenanceStatus = "explicit" | "normalized" | "inferred" | "missing" | "uncertain";

export interface FieldProvenanceEntry {
  status: FieldProvenanceStatus;
  evidence?: string;
}

export type ProvenanceMap = Record<string, FieldProvenanceEntry>;

/**
 * Merge precedence (documented here, enforced across service.ts + the
 * client-side apply-to-form logic):
 *
 *   user-entered existing form value (client-side only)
 *     > explicit deterministic value (high-confidence regex/URL parsing)
 *     > explicit AI-extracted value
 *     > normalized value (deterministic cleanup of an AI/raw value)
 *     > inferred classification (AI guessed/generalized, not read verbatim)
 *     > missing
 *
 * The parser API endpoint itself has no concept of "user already typed
 * this" — that context only exists client-side, at apply-time, inside
 * apply-to-form.ts. The endpoint's output is the deterministic-vs-AI
 * merge only.
 */
export const MERGE_PRECEDENCE_NOTE =
  "user-entered > explicit-deterministic > explicit-ai > normalized > inferred > missing";

export interface ParseMetadataInfo {
  modelUsed: string;
  initialModel: string;
  finalModel: string;
  /**
   * True if a same-model retry occurred (retryable provider error, malformed
   * structured output, or Zod validation failure on the first attempt).
   * initialModel and finalModel are always the same primary model now —
   * this field name is kept for API/DB compatibility with historical rows
   * recorded under the old nano-then-mini fallback strategy; the Settings
   * UI labels it "Retry uses".
   */
  fallbackUsed: boolean;
  cached: boolean;
  parserSchemaVersion: string;
  promptVersion: string;
  latencyMs: number;
}

/** Full internal result: raw AI groups (deterministic-merged) + provenance + parse metadata. */
export interface AiParserResult {
  identity: IdentityGroup;
  location: LocationGroup;
  employment: EmploymentGroup;
  compensation: CompensationGroup;
  skills: SkillsGroup;
  experienceEducation: ExperienceEducationGroup;
  roleContent: RoleContentGroup;
  immigration: ImmigrationGroup;
  quantRelevance: QuantRelevanceGroup;
  metadata: MetadataGroup;
  provenance: ProvenanceMap;
  parseMeta: ParseMetadataInfo;
}

// ---------------------------------------------------------------------
// Incoming HTTP request schema. `.strict()` rejects any extra
// client-supplied keys (e.g. a tampered `model`, `cost`, or
// `authorization` field) rather than silently ignoring them.
// ---------------------------------------------------------------------

export interface AiParserApiResponse {
  result: AiParserResult;
  provenance: ProvenanceMap;
  cacheHit: boolean;
  modelUsed: string;
  fallbackUsed: boolean;
  parserVersion: string;
  descriptionHash: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number };
}

export const parseRequestSchema = z
  .object({
    jobDescription: z.string(),
    jobUrl: httpUrlSchema.optional(),
    forceRefresh: z.boolean().optional(),
  })
  .strict();

export type ParseRequest = z.infer<typeof parseRequestSchema>;

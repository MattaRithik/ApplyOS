import type { AiParserResult, FieldProvenanceStatus } from "@/lib/ai-parser/schema";
import type { ApplicationFormValues } from "@/components/applications/application-form";
import { EMPTY_HR_CONTACT } from "@/components/applications/types";
import type { VisaSponsorshipStatus, WorkMode, EmploymentType } from "@/lib/types/database";

/**
 * Every acceptable field is addressed by a dotted group.field path (matching
 * the provenance map keys), e.g. "identity.companyName". Two synthetic keys
 * (not backed by the raw AI schema) let the caller also accept the
 * suggested follow-up date / a recruiter contact bundle.
 */
export type AcceptableFieldKey = string;

const WORKPLACE_TO_WORK_MODE: Record<string, WorkMode | null> = {
  remote: "remote",
  hybrid: "hybrid",
  onsite: "onsite",
  unknown: null,
};

const EMPLOYMENT_TYPE_MAP: Record<string, EmploymentType | null> = {
  full_time: "full_time",
  part_time: "part_time",
  internship: "internship",
  contract: "contract",
  temporary: "temporary",
  seasonal: null,
  apprenticeship: null,
  unknown: null,
};

const VISA_SPONSORSHIP_MAP: Record<string, VisaSponsorshipStatus | null> = {
  available: "h1b_available",
  not_available: "no_sponsorship",
  unclear: "future_possible",
  not_mentioned: "not_mentioned",
};

function get(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/** Dotted field paths that map directly onto a top-level ApplicationFormValues key (with optional value transform). */
const DIRECT_MAP: Record<string, { formKey: keyof ApplicationFormValues; transform?: (v: unknown) => unknown }> = {
  "identity.companyName": { formKey: "company_name" },
  "identity.jobTitle": { formKey: "job_title" },
  "identity.sourcePlatform": { formKey: "source" },
  "location.rawLocation": { formKey: "location" },
  "location.workplaceType": { formKey: "work_mode", transform: (v) => WORKPLACE_TO_WORK_MODE[String(v)] ?? null },
  "employment.employmentType": { formKey: "employment_type", transform: (v) => EMPLOYMENT_TYPE_MAP[String(v)] ?? null },
  "compensation.salaryMinimum": { formKey: "salary_min" },
  "compensation.salaryMaximum": { formKey: "salary_max" },
  "compensation.salaryCurrency": { formKey: "salary_currency" },
  "immigration.sponsorshipText": { formKey: "visa_sponsorship_notes" },
  "immigration.visaSponsorship": { formKey: "visa_sponsorship_status", transform: (v) => VISA_SPONSORSHIP_MAP[String(v)] ?? "not_mentioned" },
  "skills.requiredSkills": { formKey: "required_skills" },
  "skills.preferredSkills": { formKey: "preferred_skills" },
  "skills.keywords": { formKey: "keywords" },
};

/**
 * Extra-conservative fields per the "blank is better than wrong" rule —
 * these only auto-apply when provenance is strictly "explicit" (never
 * "normalized"), since a wrong guess here (sponsorship, salary, a
 * recruiter's email, the source platform, location/workplace type) is
 * actively misleading rather than just a missed convenience.
 */
const RISKY_FIELDS = new Set<string>([
  "immigration.visaSponsorship",
  "immigration.sponsorshipText",
  "immigration.workAuthorizationRequirement",
  "immigration.citizenshipRequirement",
  "immigration.securityClearanceRequirement",
  "compensation.salaryMinimum",
  "compensation.salaryMaximum",
  "identity.recruiterEmail",
  "identity.sourcePlatform",
  "location.rawLocation",
  "location.workplaceType",
]);

/** Notes sections, grouped for readable Markdown-style output instead of one flat "Label: value" block. */
type NotesSection = "requirements" | "benefits" | "compensation" | "workArrangement" | "extra";

interface NotesFieldSpec {
  label: string;
  section: NotesSection;
}

/** Fields with no dedicated form column — folded into the notes block instead, grouped by section. */
const NOTES_FIELDS: Record<string, NotesFieldSpec> = {
  "identity.requisitionId": { label: "Requisition ID", section: "extra" },
  "identity.department": { label: "Department", section: "extra" },
  "identity.team": { label: "Team", section: "extra" },
  "identity.industry": { label: "Industry", section: "extra" },
  "identity.companyDescription": { label: "Company Description", section: "extra" },
  "identity.hiringManagerName": { label: "Hiring Manager", section: "extra" },
  "location.city": { label: "City", section: "workArrangement" },
  "location.stateOrRegion": { label: "State/Region", section: "workArrangement" },
  "location.country": { label: "Country", section: "workArrangement" },
  "location.relocationAvailable": { label: "Relocation Available", section: "workArrangement" },
  "location.travelRequirement": { label: "Travel Requirement", section: "workArrangement" },
  "location.allowedWorkLocations": { label: "Allowed Work Locations", section: "workArrangement" },
  "employment.seniorityLevel": { label: "Seniority Level", section: "extra" },
  "employment.roleCategory": { label: "Role Category", section: "extra" },
  "employment.roleSubcategory": { label: "Role Subcategory", section: "extra" },
  "employment.managementRole": { label: "Management Role", section: "extra" },
  "employment.internshipTerm": { label: "Internship Term", section: "extra" },
  "employment.expectedStartDate": { label: "Expected Start Date", section: "workArrangement" },
  "compensation.salaryPeriod": { label: "Salary Period", section: "compensation" },
  "compensation.bonusMentioned": { label: "Bonus Mentioned", section: "compensation" },
  "compensation.equityMentioned": { label: "Equity Mentioned", section: "compensation" },
  "compensation.commissionMentioned": { label: "Commission Mentioned", section: "compensation" },
  "compensation.compensationIsEstimated": { label: "Compensation Is Estimated", section: "compensation" },
  "compensation.compensationText": { label: "Compensation Notes", section: "compensation" },
  "skills.programmingLanguages": { label: "Programming Languages", section: "requirements" },
  "skills.frameworks": { label: "Frameworks", section: "requirements" },
  "skills.libraries": { label: "Libraries", section: "requirements" },
  "skills.databases": { label: "Databases", section: "requirements" },
  "skills.cloudPlatforms": { label: "Cloud Platforms", section: "requirements" },
  "skills.dataTools": { label: "Data Tools", section: "requirements" },
  "skills.financeTools": { label: "Finance Tools", section: "requirements" },
  "skills.machineLearningTools": { label: "Machine Learning Tools", section: "requirements" },
  "skills.developerTools": { label: "Developer Tools", section: "requirements" },
  "skills.methodologies": { label: "Methodologies", section: "requirements" },
  "skills.domainKnowledge": { label: "Domain Knowledge", section: "requirements" },
  "skills.softSkills": { label: "Soft Skills", section: "requirements" },
  "experienceEducation.minimumYearsExperience": { label: "Minimum Years Experience", section: "requirements" },
  "experienceEducation.maximumYearsExperience": { label: "Maximum Years Experience", section: "requirements" },
  "experienceEducation.experienceText": { label: "Experience", section: "requirements" },
  "experienceEducation.educationLevel": { label: "Education Level", section: "requirements" },
  "experienceEducation.fieldsOfStudy": { label: "Fields of Study", section: "requirements" },
  "experienceEducation.graduateDegreeRequired": { label: "Graduate Degree Required", section: "requirements" },
  "experienceEducation.certificationsRequired": { label: "Certifications Required", section: "requirements" },
  "experienceEducation.certificationsPreferred": { label: "Certifications Preferred", section: "requirements" },
  "roleContent.conciseSummary": { label: "Summary", section: "extra" },
  "roleContent.responsibilities": { label: "Responsibilities", section: "requirements" },
  "roleContent.requiredQualifications": { label: "Required Qualifications", section: "requirements" },
  "roleContent.preferredQualifications": { label: "Preferred Qualifications", section: "requirements" },
  "roleContent.benefits": { label: "Benefits", section: "benefits" },
  "roleContent.interviewProcess": { label: "Interview Process", section: "extra" },
  "roleContent.schedule": { label: "Schedule", section: "workArrangement" },
  "roleContent.shift": { label: "Shift", section: "workArrangement" },
  "immigration.workAuthorizationRequirement": { label: "Work Authorization Requirement", section: "extra" },
  "immigration.citizenshipRequirement": { label: "Citizenship Requirement", section: "extra" },
  "immigration.securityClearanceRequirement": { label: "Security Clearance Requirement", section: "extra" },
  "immigration.exportControlRestriction": { label: "Export Control Restriction", section: "extra" },
  "immigration.backgroundCheckMentioned": { label: "Background Check Mentioned", section: "extra" },
};

/** Backward-compatible flat label lookup, kept for anything still reading `NOTES_LABELS`. */
const NOTES_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(NOTES_FIELDS).map(([path, spec]) => [path, spec.label])
);

const DIRECT_LABELS: Record<string, string> = {
  "identity.companyName": "Company Name",
  "identity.jobTitle": "Job Title",
  "identity.sourcePlatform": "Source Platform",
  "location.rawLocation": "Location",
  "location.workplaceType": "Workplace Type",
  "employment.employmentType": "Employment Type",
  "compensation.salaryMinimum": "Salary Minimum",
  "compensation.salaryMaximum": "Salary Maximum",
  "compensation.salaryCurrency": "Salary Currency",
  "immigration.sponsorshipText": "Sponsorship Notes",
  "immigration.visaSponsorship": "Visa Sponsorship",
  "skills.requiredSkills": "Required Skills",
  "skills.preferredSkills": "Preferred Skills",
  "skills.keywords": "Keywords",
};

/** Every field path this module knows how to apply to the form, with a display label — used to drive the review panel UI. */
export const ALL_FIELD_LABELS: Record<string, string> = {
  ...DIRECT_LABELS,
  ...NOTES_LABELS,
  "identity.recruiterName": "Recruiter Name",
  "identity.recruiterEmail": "Recruiter Email",
};

export const SYNTHETIC_DEADLINE_KEY = "roleContent.applicationDeadline";
export const SYNTHETIC_RECRUITER_CONTACT_KEY = "__recruiterContact";

/** Best-effort parse of a free-text deadline into an ISO yyyy-MM-dd string, or null if unparseable. */
function parseDeadlineToIso(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

// The form initializes a couple of fields to a non-empty placeholder that
// means "nothing specified yet" rather than a value the user actually
// typed/chose — treating these as "already filled in" would silently skip
// otherwise-safe explicit fields (e.g. a real "not_available" sponsorship
// detection getting skipped because the form's untouched default is the
// literal string "not_mentioned", not an empty string).
const DEFAULT_PLACEHOLDER_VALUES = new Set(["not_mentioned", "USD"]);

function isFormValueEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" || DEFAULT_PLACEHOLDER_VALUES.has(trimmed);
  }
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Decides which extracted fields are safe to auto-apply without asking the
 * user to individually confirm each one — "blank is better than wrong":
 *
 *   - never a field the model itself flagged inferred/uncertain;
 *   - risky fields (sponsorship, salary, recruiter email, source platform,
 *     location/workplace type, ...) require strictly "explicit" provenance;
 *   - everything else accepts "explicit" or "normalized";
 *   - never a field that would overwrite a value already present in the
 *     current form (the user's own typed input always wins).
 */
export function selectSafeFieldsToApply(result: AiParserResult, current: ApplicationFormValues): Set<AcceptableFieldKey> {
  const safe = new Set<AcceptableFieldKey>();

  const isAcceptableStatus = (path: string, status: FieldProvenanceStatus | undefined): boolean => {
    if (!status) return false;
    if (RISKY_FIELDS.has(path)) return status === "explicit";
    return status === "explicit" || status === "normalized";
  };

  for (const [path, direct] of Object.entries(DIRECT_MAP)) {
    const value = get(result, path);
    if (value === null || value === undefined) continue;
    if (!isAcceptableStatus(path, result.provenance[path]?.status)) continue;
    if (!isFormValueEmpty((current as unknown as Record<string, unknown>)[direct.formKey])) continue;
    safe.add(path);
  }

  for (const path of Object.keys(NOTES_FIELDS)) {
    const value = get(result, path);
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (!isAcceptableStatus(path, result.provenance[path]?.status)) continue;
    // Notes only ever appends, never overwrites an existing value — always
    // safe to include once the provenance bar above is cleared.
    safe.add(path);
  }

  if (result.identity.recruiterEmail && result.provenance["identity.recruiterEmail"]?.status === "explicit") {
    safe.add(SYNTHETIC_RECRUITER_CONTACT_KEY);
  }

  if (
    result.roleContent.applicationDeadline &&
    result.provenance["roleContent.applicationDeadline"]?.status === "explicit" &&
    isFormValueEmpty(current.follow_up_date)
  ) {
    safe.add(SYNTHETIC_DEADLINE_KEY);
  }

  return safe;
}

/** @deprecated kept for any lingering imports — use {@link selectSafeFieldsToApply}. */
export const selectSafeFieldsToAutoApply = selectSafeFieldsToApply;

const SECTION_HEADINGS: Record<NotesSection, string> = {
  requirements: "Requirements & Qualifications",
  benefits: "Benefits",
  compensation: "Compensation",
  workArrangement: "Work Arrangement",
  extra: "Extra Details",
};

const SECTION_ORDER: NotesSection[] = ["requirements", "benefits", "compensation", "workArrangement", "extra"];

// The Notes field renders as plain pre-wrapped text (no Markdown parser in
// the app) — an uppercase heading with clear spacing reads cleanly there,
// whereas literal "**Heading**" asterisks would just show up as asterisks.
function renderNotesSection(heading: string, lines: { label: string; value: unknown }[]): string {
  const body = lines
    .map(({ label, value }) => {
      if (Array.isArray(value)) {
        return value.map((item) => `• ${item}`).join("\n");
      }
      return `${label}: ${formatValue(value)}`;
    })
    .join("\n");
  return `${heading.toUpperCase()}\n${body}`;
}

/**
 * Applies the accepted fields onto the current form values. Never
 * overwrites a non-empty existing value unless that field's key is
 * explicitly present in `acceptedKeys` — the caller decides which keys are
 * safe to include (see {@link selectSafeFieldsToApply}).
 */
export function applyParsedResultToForm(
  current: ApplicationFormValues,
  result: AiParserResult,
  acceptedKeys: Set<AcceptableFieldKey>
): ApplicationFormValues {
  const next: ApplicationFormValues = { ...current };
  const bySection: Record<NotesSection, { label: string; value: unknown }[]> = {
    requirements: [],
    benefits: [],
    compensation: [],
    workArrangement: [],
    extra: [],
  };

  for (const key of acceptedKeys) {
    if (key === SYNTHETIC_DEADLINE_KEY) {
      const iso = parseDeadlineToIso(result.roleContent.applicationDeadline);
      if (iso) next.follow_up_date = iso;
      continue;
    }
    if (key === SYNTHETIC_RECRUITER_CONTACT_KEY) {
      const name = result.identity.recruiterName;
      const email = result.identity.recruiterEmail;
      if (name || email) {
        next.hrContacts = [
          ...next.hrContacts,
          { ...EMPTY_HR_CONTACT, name: name ?? "", email: email ?? "", relationship_type: "recruiter" },
        ];
      }
      continue;
    }

    const value = get(result, key);
    if (value === null || value === undefined) continue;

    const direct = DIRECT_MAP[key];
    if (direct) {
      // Never silently clobber a value already present in the form — the
      // caller's accepted-keys set is expected to already exclude these,
      // but this stays as a hard backstop.
      if (!isFormValueEmpty((next as unknown as Record<string, unknown>)[direct.formKey])) continue;
      const transformed = direct.transform ? direct.transform(value) : value;
      (next as unknown as Record<string, unknown>)[direct.formKey] = transformed;
      continue;
    }

    const spec = NOTES_FIELDS[key];
    if (spec) {
      bySection[spec.section].push({ label: spec.label, value });
    }
  }

  const sectionBlocks = SECTION_ORDER.filter((s) => bySection[s].length > 0).map((s) =>
    renderNotesSection(SECTION_HEADINGS[s], bySection[s])
  );

  if (sectionBlocks.length > 0) {
    const parsedBlock = `— Parsed from job description —\n\n${sectionBlocks.join("\n\n")}`;
    next.notes = [current.notes, parsedBlock].filter(Boolean).join("\n\n");
  }

  return next;
}

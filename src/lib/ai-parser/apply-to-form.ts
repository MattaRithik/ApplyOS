import type { AiParserResult } from "@/lib/ai-parser/schema";
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

/** Fields with no dedicated form column — folded into the notes block instead, labeled by their group. */
const NOTES_LABELS: Record<string, string> = {
  "identity.requisitionId": "Requisition ID",
  "identity.sourcePlatform": "Source Platform",
  "identity.department": "Department",
  "identity.team": "Team",
  "identity.industry": "Industry",
  "identity.companyDescription": "Company Description",
  "identity.hiringManagerName": "Hiring Manager",
  "location.city": "City",
  "location.stateOrRegion": "State/Region",
  "location.country": "Country",
  "location.relocationAvailable": "Relocation Available",
  "location.travelRequirement": "Travel Requirement",
  "location.allowedWorkLocations": "Allowed Work Locations",
  "employment.seniorityLevel": "Seniority Level",
  "employment.roleCategory": "Role Category",
  "employment.roleSubcategory": "Role Subcategory",
  "employment.managementRole": "Management Role",
  "employment.internshipTerm": "Internship Term",
  "employment.expectedStartDate": "Expected Start Date",
  "compensation.salaryPeriod": "Salary Period",
  "compensation.bonusMentioned": "Bonus Mentioned",
  "compensation.equityMentioned": "Equity Mentioned",
  "compensation.commissionMentioned": "Commission Mentioned",
  "compensation.compensationIsEstimated": "Compensation Is Estimated",
  "compensation.compensationText": "Compensation Notes",
  "skills.programmingLanguages": "Programming Languages",
  "skills.frameworks": "Frameworks",
  "skills.libraries": "Libraries",
  "skills.databases": "Databases",
  "skills.cloudPlatforms": "Cloud Platforms",
  "skills.dataTools": "Data Tools",
  "skills.financeTools": "Finance Tools",
  "skills.machineLearningTools": "Machine Learning Tools",
  "skills.developerTools": "Developer Tools",
  "skills.methodologies": "Methodologies",
  "skills.domainKnowledge": "Domain Knowledge",
  "skills.softSkills": "Soft Skills",
  "experienceEducation.minimumYearsExperience": "Minimum Years Experience",
  "experienceEducation.maximumYearsExperience": "Maximum Years Experience",
  "experienceEducation.experienceText": "Experience",
  "experienceEducation.educationLevel": "Education Level",
  "experienceEducation.fieldsOfStudy": "Fields of Study",
  "experienceEducation.graduateDegreeRequired": "Graduate Degree Required",
  "experienceEducation.certificationsRequired": "Certifications Required",
  "experienceEducation.certificationsPreferred": "Certifications Preferred",
  "roleContent.conciseSummary": "Summary",
  "roleContent.responsibilities": "Responsibilities",
  "roleContent.requiredQualifications": "Required Qualifications",
  "roleContent.preferredQualifications": "Preferred Qualifications",
  "roleContent.benefits": "Benefits",
  "roleContent.interviewProcess": "Interview Process",
  "roleContent.schedule": "Schedule",
  "roleContent.shift": "Shift",
  "immigration.workAuthorizationRequirement": "Work Authorization Requirement",
  "immigration.citizenshipRequirement": "Citizenship Requirement",
  "immigration.securityClearanceRequirement": "Security Clearance Requirement",
  "immigration.exportControlRestriction": "Export Control Restriction",
  "immigration.backgroundCheckMentioned": "Background Check Mentioned",
};

const DIRECT_LABELS: Record<string, string> = {
  "identity.companyName": "Company Name",
  "identity.jobTitle": "Job Title",
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

/**
 * Applies the accepted fields onto the current form values. Never
 * silently overwrites a non-empty existing value unless that field's key
 * is explicitly present in `acceptedKeys` — the caller (checkboxes in the
 * panel UI) controls exactly which keys are in that set.
 */
export function applyParsedResultToForm(
  current: ApplicationFormValues,
  result: AiParserResult,
  acceptedKeys: Set<AcceptableFieldKey>
): ApplicationFormValues {
  const next: ApplicationFormValues = { ...current };
  const notesLines: string[] = [];

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
      const transformed = direct.transform ? direct.transform(value) : value;
      (next as unknown as Record<string, unknown>)[direct.formKey] = transformed;
      continue;
    }

    const label = NOTES_LABELS[key];
    if (label) {
      notesLines.push(`${label}: ${formatValue(value)}`);
    }
  }

  if (notesLines.length > 0) {
    const parsedBlock = `— Parsed from job description —\n\n${notesLines.join("\n\n")}`;
    next.notes = [current.notes, parsedBlock].filter(Boolean).join("\n\n");
  }

  return next;
}

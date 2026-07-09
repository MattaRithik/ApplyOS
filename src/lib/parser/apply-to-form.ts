import type { ParsedJobResult } from "@/lib/parser/types";
import type { ApplicationFormValues } from "@/components/applications/application-form";

export const PARSER_FIELD_LABELS: Record<keyof ParsedJobResult, string> = {
  company: "Company",
  jobTitle: "Job Title",
  roleType: "Role Type",
  location: "Location",
  workMode: "Work Mode",
  employmentType: "Employment Type",
  salaryRange: "Salary Range",
  requiredSkills: "Required Skills",
  preferredSkills: "Preferred Skills",
  education: "Education",
  yearsExperience: "Years of Experience",
  visaNotes: "Visa / Work Authorization",
  deadline: "Application Deadline",
  recruiterInfo: "Recruiter / HR Info",
  keywords: "Keywords",
  jobSummary: "Job Summary",
  resumeMatchScore: "Resume Match Score",
  missingSkills: "Missing Skills",
  suggestedResumeVersion: "Suggested Resume Version",
  suggestedColdEmailAngle: "Suggested Cold Email Angle",
  suggestedFollowUpDate: "Suggested Follow-up Date",
  priorityScore: "Priority Score",
};

// Fields that map directly onto an Application column.
const DIRECT_MAP: Partial<Record<keyof ParsedJobResult, keyof ApplicationFormValues>> = {
  company: "company_name",
  jobTitle: "job_title",
  location: "location",
  workMode: "work_mode",
  employmentType: "employment_type",
  visaNotes: "visa_sponsorship_notes",
  keywords: "keywords",
  requiredSkills: "required_skills",
  preferredSkills: "preferred_skills",
  suggestedFollowUpDate: "follow_up_date",
  priorityScore: "priority_score",
};

// Fields with no dedicated column — folded into the notes block instead.
const NOTES_FIELDS: (keyof ParsedJobResult)[] = [
  "roleType",
  "salaryRange",
  "education",
  "yearsExperience",
  "deadline",
  "jobSummary",
  "missingSkills",
  "suggestedResumeVersion",
  "suggestedColdEmailAngle",
];

function formatFieldForNotes(key: keyof ParsedJobResult, value: unknown): string {
  const label = PARSER_FIELD_LABELS[key];
  const text = Array.isArray(value) ? value.join(", ") : String(value);
  return `${label}: ${text}`;
}

export function applyParsedFieldsToForm(
  current: ApplicationFormValues,
  parsed: ParsedJobResult,
  acceptedKeys: Set<keyof ParsedJobResult>
): ApplicationFormValues {
  const next: ApplicationFormValues = { ...current };
  const notesLines: string[] = [];

  for (const key of acceptedKeys) {
    const field = parsed[key];
    if (!field) continue;

    if (key === "recruiterInfo") {
      const value = String(field.value);
      if (value.includes("@")) next.hr_email = value;
      else next.recruiter_name = value;
      continue;
    }

    const targetKey = DIRECT_MAP[key];
    if (targetKey) {
      (next as unknown as Record<string, unknown>)[targetKey] = field.value;
    } else if (NOTES_FIELDS.includes(key)) {
      notesLines.push(formatFieldForNotes(key, field.value));
    }
  }

  if (notesLines.length > 0) {
    next.notes = [current.notes, "— Parsed from job description —", ...notesLines]
      .filter(Boolean)
      .join("\n");
  }

  return next;
}

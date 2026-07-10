import type { JobExtraction } from "@/lib/parser/schema";
import type { ApplicationFormValues } from "@/components/applications/application-form";
import { EMPTY_HR_CONTACT } from "@/components/applications/types";

export type AcceptableFieldKey = keyof JobExtraction | "suggestedFollowUpDate" | "priorityScore";

export const EXTRACTION_FIELD_LABELS: Record<keyof JobExtraction, string> = {
  companyName: "Company Name",
  companyWebsite: "Company Website",
  companyLinkedInUrl: "LinkedIn Company URL",
  jobTitle: "Job Title",
  department: "Department",
  roleCategory: "Role Category",
  employmentType: "Employment Type",
  workMode: "Work Mode",
  locations: "Locations",
  salaryMin: "Salary Min",
  salaryMax: "Salary Max",
  currency: "Currency",
  experience: "Experience",
  education: "Education",
  requiredSkills: "Required Skills",
  preferredSkills: "Preferred Skills",
  programmingLanguages: "Programming Languages",
  technologies: "Technologies",
  financeSkills: "Finance Skills",
  softSkills: "Soft Skills",
  keywords: "Keywords",
  responsibilities: "Responsibilities",
  qualifications: "Qualifications",
  preferredQualifications: "Preferred Qualifications",
  deadline: "Deadline",
  jobId: "Job ID",
  recruiterName: "Recruiter Name",
  recruiterEmail: "Recruiter Email",
  jobSummary: "Job Summary",
  jobBoard: "Job Board",
  visaStatus: "Visa Sponsorship",
};

/** Extraction fields that map directly onto an Application form column. */
const DIRECT_MAP: Partial<Record<keyof JobExtraction, keyof ApplicationFormValues>> = {
  companyName: "company_name",
  jobTitle: "job_title",
  workMode: "work_mode",
  employmentType: "employment_type",
  currency: "salary_currency",
  visaStatus: "visa_sponsorship_status",
  keywords: "keywords",
  requiredSkills: "required_skills",
  preferredSkills: "preferred_skills",
};

/** Fields with no dedicated column — folded into the notes block instead. */
const NOTES_FIELDS: (keyof JobExtraction)[] = [
  "department",
  "roleCategory",
  "education",
  "experience",
  "programmingLanguages",
  "technologies",
  "financeSkills",
  "softSkills",
  "responsibilities",
  "qualifications",
  "preferredQualifications",
  "deadline",
  "jobId",
  "jobSummary",
  "jobBoard",
];

function formatFieldForNotes(key: keyof JobExtraction, value: unknown): string {
  const label = EXTRACTION_FIELD_LABELS[key];
  const text = Array.isArray(value) ? value.join(", ") : String(value);
  return `${label}: ${text}`;
}

export function applyExtractionFieldsToForm(
  current: ApplicationFormValues,
  extraction: JobExtraction,
  suggestedFollowUpDate: string | undefined,
  priorityScore: number | undefined,
  acceptedKeys: Set<AcceptableFieldKey>
): ApplicationFormValues {
  const next: ApplicationFormValues = { ...current };
  const notesLines: string[] = [];
  let addedHrContact = false;

  for (const key of acceptedKeys) {
    if (key === "suggestedFollowUpDate") {
      if (suggestedFollowUpDate) next.follow_up_date = suggestedFollowUpDate;
      continue;
    }
    if (key === "priorityScore") {
      if (typeof priorityScore === "number") next.priority_score = priorityScore;
      continue;
    }

    const field = extraction[key];
    if (!field) continue;

    if (key === "locations") {
      next.location = (field.value as string[]).join(", ");
      continue;
    }
    if (key === "salaryMin") {
      next.salary_min = field.value as number;
      continue;
    }
    if (key === "salaryMax") {
      next.salary_max = field.value as number;
      continue;
    }
    if (key === "recruiterName" || key === "recruiterEmail") {
      if (!addedHrContact) {
        next.hrContacts = [
          ...next.hrContacts,
          {
            ...EMPTY_HR_CONTACT,
            name: extraction.recruiterName?.value ?? "",
            email: extraction.recruiterEmail?.value ?? "",
            relationship_type: "recruiter",
          },
        ];
        addedHrContact = true;
      }
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
    next.notes = [current.notes, "— Parsed from job description —", ...notesLines].filter(Boolean).join("\n");
  }

  return next;
}

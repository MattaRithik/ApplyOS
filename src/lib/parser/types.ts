export interface ParsedField<T> {
  value: T;
  confidence: number; // 0-100
}

export interface ParsedJobResult {
  company?: ParsedField<string>;
  jobTitle?: ParsedField<string>;
  roleType?: ParsedField<string>;
  location?: ParsedField<string>;
  workMode?: ParsedField<"remote" | "hybrid" | "onsite">;
  employmentType?: ParsedField<"full_time" | "part_time" | "internship" | "contract" | "temporary">;
  salaryRange?: ParsedField<string>;
  requiredSkills?: ParsedField<string[]>;
  preferredSkills?: ParsedField<string[]>;
  education?: ParsedField<string>;
  yearsExperience?: ParsedField<string>;
  visaNotes?: ParsedField<string>;
  deadline?: ParsedField<string>;
  recruiterInfo?: ParsedField<string>;
  keywords?: ParsedField<string[]>;
  jobSummary?: ParsedField<string>;
  resumeMatchScore?: ParsedField<number>;
  missingSkills?: ParsedField<string[]>;
  suggestedResumeVersion?: ParsedField<string>;
  suggestedColdEmailAngle?: ParsedField<string>;
  suggestedFollowUpDate?: ParsedField<string>;
  priorityScore?: ParsedField<number>;
}

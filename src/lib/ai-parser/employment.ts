import type { RawAiJobParse, ProvenanceMap } from "./schema";

/** Prefer explicit role/type wording to title-based guesses such as Summer Analyst. */
export function validateEmployment(result: RawAiJobParse, text: string): ProvenanceMap {
  const typePath = "employment.employmentType";
  const normalized = text.replace(/[–—]/g, "-");
  const title = result.identity.jobTitle?.trim();
  const internshipTitle = title && /\bintern(?:ship)?\b/i.test(title) && normalized.toLowerCase().includes(title.replace(/[–—]/g, "-").toLowerCase());
  const explicitInternship = normalized.match(/(?:employment type|job type|position type)\s*:?\s*internship\b|\bthis (?:role|position|program) is (?:a |an )?(?:paid |unpaid )?internship\b|\b(?:this|the|our) (?:summer |paid |unpaid )?internship\b/i);
  if (internshipTitle || explicitInternship) {
    result.employment.employmentType = "internship";
    return { [typePath]: { status: "explicit", evidence: internshipTitle ? title! : explicitInternship![0] } };
  }
  const schedule = normalized.match(/(?:employment type|job type|position type|job schedule)\s*:?\s*(full[ -]?time|part[ -]?time)\b|\bthis (?:role|position) is (?:a |an )?(full[ -]?time|part[ -]?time)\b/i);
  if (schedule) {
    result.employment.employmentType = /part[ -]?time/i.test(schedule[0]) ? "part_time" : "full_time";
    result.employment.internshipTerm = null;
    if (/job category\s*:?\s*seasonal employee/i.test(normalized)) result.metadata.warnings = [...(result.metadata.warnings ?? []), "Full time describes the work schedule; the posting also classifies this role as Seasonal Employee. It does not establish a permanent position."];
    return { [typePath]: { status: "explicit", evidence: schedule[0] } };
  }
  if (result.employment.employmentType === "internship") {
    result.employment.employmentType = "unknown";
    result.employment.internshipTerm = null;
    result.metadata.warnings = [...(result.metadata.warnings ?? []), "Employment type needs review: the posting does not explicitly identify this role as an internship."];
    return { [typePath]: { status: "uncertain" } };
  }
  return {};
}

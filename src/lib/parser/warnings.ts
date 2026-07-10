import type { JobExtraction, ResumeComparison, DuplicateInfo } from "@/lib/parser/schema";

export function buildWarnings(
  extraction: JobExtraction,
  resumeComparison: ResumeComparison | null,
  duplicate: DuplicateInfo
): string[] {
  const warnings: string[] = [];

  if (extraction.visaStatus?.value === "no_sponsorship") {
    warnings.push("This posting explicitly states no visa sponsorship is offered.");
  } else if (!extraction.visaStatus || extraction.visaStatus.value === "not_mentioned") {
    warnings.push("Visa sponsorship isn't mentioned in the posting — worth confirming directly.");
  }

  if (!extraction.salaryMin && !extraction.salaryMax) {
    warnings.push("No salary information found in the posting.");
  }

  if (!extraction.recruiterName && !extraction.recruiterEmail) {
    warnings.push("No recruiter or HR contact listed.");
  }

  if (!extraction.deadline) {
    warnings.push("No application deadline found.");
  }

  const experienceText = extraction.experience?.value ?? "";
  const yearsNeeded = Number(experienceText.match(/\d+/)?.[0] ?? 0);
  if (yearsNeeded >= 5) {
    warnings.push(`Posting asks for ${experienceText} — confirm this matches your experience level.`);
  }

  if (resumeComparison && resumeComparison.overallMatchPercent < 40) {
    warnings.push(`Resume match is low (${resumeComparison.overallMatchPercent}%) — consider tailoring your resume before applying.`);
  }

  if (duplicate.isDuplicate) {
    warnings.push(
      `A similar application already exists (matched on ${duplicate.matchedOn?.join(", ") || "company/title"}) — check you haven't already applied.`
    );
  }

  return warnings;
}

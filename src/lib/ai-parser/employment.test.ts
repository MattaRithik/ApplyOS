import { expect, it } from "vitest";
import { validateExtraction } from "./quality";
import { rawAiJobParseSchema } from "./schema";
import { validRawResponse } from "@/test/fixtures/ai-parser";
import { compensationLabel } from "@/lib/utils/compensation-label";

function parse(text: string, title = "Quantitative Research – Asset Management Summer Analyst") {
  const raw = rawAiJobParseSchema.parse(validRawResponse());
  raw.identity.jobTitle = title;
  raw.employment.employmentType = "internship";
  raw.employment.internshipTerm = "summer";
  return validateExtraction(raw, text);
}
it("preserves the JPMorgan posting's full-time schedule instead of guessing internship", () => {
  const posting = "Quantitative Research – Asset Management Summer Analyst\nJob Category\nSeasonal Employee\nJob Schedule\nFull time\nBase Pay/Salary\nNew York, NY $100,000-$100,000\nThis program has potential full-time offers upon successful completion.";
  const { result, provenance } = parse(posting);
  expect(result.employment.employmentType).toBe("full_time");
  expect(result.employment.internshipTerm).toBeNull();
  expect(provenance["employment.employmentType"]).toMatchObject({ status: "explicit", evidence: "Job Schedule\nFull time" });
  expect(result.metadata.warnings?.some((warning) => warning.includes("Seasonal Employee"))).toBe(true);
  expect(compensationLabel(posting)).toBe("Salary");
});
it("does not infer internship from a summer analyst title or future conversion offers alone", () => {
  const { result, provenance } = parse("Summer Analyst program with potential full-time offers upon completion.");
  expect(result.employment.employmentType).toBe("unknown");
  expect(provenance["employment.employmentType"].status).toBe("uncertain");
});
it("keeps an explicitly identified internship even when its hours are full-time", () => {
  const posting = "Quantitative Research Intern\nJob Schedule: Full time\nSalary range: $40-$50 per hour.";
  const { result } = parse(posting, "Quantitative Research Intern");
  expect(result.employment.employmentType).toBe("internship");
  expect(compensationLabel(posting)).toBe("Salary");
});
it("does not confuse previous internship experience with the current role's type", () => {
  expect(parse("Job Schedule: Full time\nPrior internship experience is preferred.").result.employment.employmentType).toBe("full_time");
});
it("only calls pay a stipend when the terms actually identify a stipend", () => {
  expect(compensationLabel("Monthly stipend of USD 4,000.")).toBe("Stipend");
  expect(compensationLabel("Stipend: $3,000 per month.")).toBe("Stipend");
  expect(compensationLabel("Salary range: $100,000. Monthly housing stipend of $500.")).toBe("Salary");
  expect(compensationLabel("Travel stipend: $500.")).toBe("Salary");
});

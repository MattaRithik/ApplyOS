import { describe, expect, it } from "vitest";
import { runDeterministicPass } from "@/lib/ai-parser/deterministic";

describe("runDeterministicPass — recruiter email", () => {
  it("does NOT pick a disability-accommodations email as the recruiter email", () => {
    // Regression test: a live parse against a real BlackRock posting
    // whose only email address was Disability.Assistance@blackrock.com
    // previously got misattributed as the recruiter's email, because the
    // old logic took the first email found anywhere in the text with no
    // context check, and deterministic values outrank the AI's own
    // (correct, null) judgment in the merge.
    const text =
      "If reasonable accommodation/adjustments are needed throughout the employment process, please email Disability.Assistance@blackrock.com. All requests are treated in line with our privacy policy.";
    const result = runDeterministicPass(text);
    expect(result.partial.identity?.recruiterEmail).toBeUndefined();
  });

  it("still rejects a lone non-recruiting email even with generic recruiting-context language elsewhere", () => {
    const text = "Questions about this role? Email our compliance team at legal-notices@example.com for details.";
    const result = runDeterministicPass(text);
    expect(result.partial.identity?.recruiterEmail).toBeUndefined();
  });

  it("accepts an email with a recruiting-flavored local part", () => {
    const text = "For questions, reach out to talent@example.com.";
    const result = runDeterministicPass(text);
    expect(result.partial.identity?.recruiterEmail).toBe("talent@example.com");
  });

  it("accepts the sole email when recruiting-context language is present nearby", () => {
    const text = "Recruiter: Jane Doe, jane.doe@citadelsecurities.com";
    const result = runDeterministicPass(text);
    expect(result.partial.identity?.recruiterEmail).toBe("jane.doe@citadelsecurities.com");
  });

  it("leaves recruiterEmail unset when there is no email in the text at all", () => {
    const result = runDeterministicPass("A job posting with no contact email whatsoever.");
    expect(result.partial.identity?.recruiterEmail).toBeUndefined();
  });
});

describe("runDeterministicPass — workplace type", () => {
  it("detects hybrid from a below-the-fold work-model paragraph, not just the header", () => {
    // Regression test: a live parse missed "hybrid" because the posting
    // stated the work model in a dedicated paragraph well below the job
    // title/location line, not near the top of the text.
    const text = `Quantitative Researcher — Example Corp
New York, NY

Lots of unrelated content about the role, responsibilities, and qualifications goes here across several paragraphs so the work-model paragraph below is genuinely "below the fold" relative to the header.

Our hybrid work model is designed to enable collaboration. Employees are currently required to work at least 4 days in the office per week, with the flexibility to work from home 1 day a week.`;
    const result = runDeterministicPass(text);
    expect(result.partial.location?.workplaceType).toBe("hybrid");
  });

  it("detects fully remote language", () => {
    const result = runDeterministicPass("This is a fully remote position open to candidates anywhere in the US.");
    expect(result.partial.location?.workplaceType).toBe("remote");
  });

  it("detects onsite/in-office language", () => {
    const result = runDeterministicPass("This role is on-site at our downtown headquarters.");
    expect(result.partial.location?.workplaceType).toBe("onsite");
  });

  it("prefers hybrid over onsite when both phrases appear (hybrid postings often mention 'in the office')", () => {
    const text = "Our hybrid work model requires employees to work in-office 3 days a week.";
    const result = runDeterministicPass(text);
    expect(result.partial.location?.workplaceType).toBe("hybrid");
  });

  it("leaves workplaceType unset when no explicit keyword is present", () => {
    const result = runDeterministicPass("A job posting that never states a work arrangement.");
    expect(result.partial.location?.workplaceType).toBeUndefined();
  });
});

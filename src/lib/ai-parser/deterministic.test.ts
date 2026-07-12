import { describe, expect, it } from "vitest";
import { runDeterministicPass, extractLikelyJobPostingUrl, cleanJobPostingDescription } from "@/lib/ai-parser/deterministic";

/** The exact style of pasted-page clutter this module is meant to strip, used as a regression fixture across several describe blocks below. */
const TOWER_LINKEDIN_PASTE = `Tower Research Capital logo
Tower Research Capital
Share
Show more options
Quantitative Trader / Researcher - US
New York, NY · Reposted 1 week ago · Over 100 people clicked apply
Promoted by hirer · Responses managed off LinkedIn

Hybrid

Full-time

Apply

Save
Save Quantitative Trader / Researcher - US at Tower Research Capital
Quantitative Trader / Researcher - US
Tower Research Capital · New York, NY (Hybrid)

Apply

Save
Show more options
Your AI-powered job assessment
Show match details
Tailor my resume
Create cover letter
Help me stand out
People you can reach out to
Rutgers University logo
Company alumni from Rutgers University and others in your network

About the job
Tower Research Capital is a leading quantitative trading firm founded in 1998...`;

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

describe("runDeterministicPass — recruiter email, extra-conservative exclusions", () => {
  it("does not treat a generic careers@ mailbox as a recruiter email", () => {
    const result = runDeterministicPass("Send your resume to careers@example.com to apply.");
    expect(result.partial.identity?.recruiterEmail).toBeUndefined();
  });

  it("does not treat a support/help desk address as a recruiter email", () => {
    const result = runDeterministicPass("Technical issues? Contact support@example.com.");
    expect(result.partial.identity?.recruiterEmail).toBeUndefined();
  });

  it("does not treat a generic info@/hr@ mailbox as a recruiter email", () => {
    expect(runDeterministicPass("Reach us at info@example.com.").partial.identity?.recruiterEmail).toBeUndefined();
    expect(runDeterministicPass("Reach us at hr@example.com.").partial.identity?.recruiterEmail).toBeUndefined();
  });
});

describe("source platform detection from URL", () => {
  it("detects LinkedIn from a job URL", () => {
    const result = runDeterministicPass("Some posting text.", "https://www.linkedin.com/jobs/view/1234567");
    expect(result.partial.identity?.sourcePlatform).toBe("LinkedIn");
  });

  it("detects Greenhouse from a job URL", () => {
    const result = runDeterministicPass("Some posting text.", "https://boards.greenhouse.io/acme/jobs/12345");
    expect(result.partial.identity?.sourcePlatform).toBe("Greenhouse");
  });

  it("prefers a supplied URL's platform over any text-based signal", () => {
    const result = runDeterministicPass("Responses managed off LinkedIn", "https://boards.greenhouse.io/acme/jobs/12345");
    expect(result.partial.identity?.sourcePlatform).toBe("Greenhouse");
  });
});

describe("source platform detection from copied page text (no URL)", () => {
  it("detects LinkedIn from 'Responses managed off LinkedIn' with no URL pasted", () => {
    const result = runDeterministicPass("Responses managed off LinkedIn");
    expect(result.partial.identity?.sourcePlatform).toBe("LinkedIn");
  });

  it("detects LinkedIn from a cluster of LinkedIn-specific UI phrases with no URL", () => {
    const text = "Your AI-powered job assessment\nTailor my resume\nPeople you can reach out to\nOver 100 people clicked apply";
    const result = runDeterministicPass(text);
    expect(result.partial.identity?.sourcePlatform).toBe("LinkedIn");
  });

  it("detects the full Tower/LinkedIn regression fixture as LinkedIn, not the employer name", () => {
    const result = runDeterministicPass(TOWER_LINKEDIN_PASTE);
    expect(result.partial.identity?.sourcePlatform).toBe("LinkedIn");
  });

  it("never invents a source platform when no platform signal is present", () => {
    const result = runDeterministicPass("A completely generic job posting with no portal-specific language at all.");
    expect(result.partial.identity?.sourcePlatform).toBeUndefined();
  });

  it("does not confuse the employer/company name for the source platform", () => {
    // "Tower Research Capital" appears many times in the fixture; it must
    // never be picked up as sourcePlatform, only actual portal phrases can be.
    const result = runDeterministicPass(TOWER_LINKEDIN_PASTE);
    expect(result.partial.identity?.sourcePlatform).not.toBe("Tower Research Capital");
  });
});

describe("extractLikelyJobPostingUrl", () => {
  it("returns null when no URL is present", () => {
    expect(extractLikelyJobPostingUrl("A posting with no links at all.")).toBeNull();
  });

  it("extracts a known-ATS job posting URL", () => {
    const text = "Apply here: https://www.linkedin.com/jobs/view/1234567890";
    expect(extractLikelyJobPostingUrl(text)).toBe("https://www.linkedin.com/jobs/view/1234567890");
  });

  it("extracts a URL with a job/career path segment on an unknown host", () => {
    const text = "See the full posting at https://careers.example.com/jobs/senior-engineer-42";
    expect(extractLikelyJobPostingUrl(text)).toBe("https://careers.example.com/jobs/senior-engineer-42");
  });

  it("does not invent a URL from a LinkedIn profile/company link", () => {
    const text = "Connect with our recruiter at https://www.linkedin.com/in/jane-doe-12345";
    expect(extractLikelyJobPostingUrl(text)).toBeNull();
  });

  it("prefers a real job posting URL over privacy/legal/social links pasted nearby", () => {
    const text = `View our privacy policy at https://example.com/privacy and follow us at https://facebook.com/example.
Apply now: https://boards.greenhouse.io/acme/jobs/98765`;
    expect(extractLikelyJobPostingUrl(text)).toBe("https://boards.greenhouse.io/acme/jobs/98765");
  });

  it("rejects unsafe protocols even if they appear as text", () => {
    const text = "javascript:alert(1) is not a real job posting link.";
    expect(extractLikelyJobPostingUrl(text)).toBeNull();
  });
});

describe("cleanJobPostingDescription", () => {
  it("removes logo/share/apply/save/repeated LinkedIn clutter and starts at the real content", () => {
    const cleaned = cleanJobPostingDescription(TOWER_LINKEDIN_PASTE);
    expect(cleaned.startsWith("About the job")).toBe(true);
    expect(cleaned).not.toMatch(/logo/i);
    expect(cleaned).not.toMatch(/^share$/im);
    expect(cleaned).not.toMatch(/show more options/i);
    expect(cleaned).not.toMatch(/^apply$/im);
    expect(cleaned).not.toMatch(/^save$/im);
    expect(cleaned).not.toMatch(/save quantitative trader/i);
  });

  it("removes AI-assessment/resume-tailoring/alumni-network clutter", () => {
    const cleaned = cleanJobPostingDescription(TOWER_LINKEDIN_PASTE);
    expect(cleaned).not.toMatch(/ai-powered job assessment/i);
    expect(cleaned).not.toMatch(/show match details/i);
    expect(cleaned).not.toMatch(/tailor my resume/i);
    expect(cleaned).not.toMatch(/create cover letter/i);
    expect(cleaned).not.toMatch(/help me stand out/i);
    expect(cleaned).not.toMatch(/people you can reach out to/i);
    expect(cleaned).not.toMatch(/company alumni/i);
  });

  it("preserves the real job content", () => {
    const cleaned = cleanJobPostingDescription(TOWER_LINKEDIN_PASTE);
    expect(cleaned).toMatch(/Tower Research Capital is a leading quantitative trading firm founded in 1998/);
  });

  it("preserves responsibilities/qualifications/salary/benefits when present", () => {
    const text = `About the job
We are hiring an engineer.

Responsibilities
- Build things
- Ship things

Qualifications
- 3+ years experience

Compensation: $120,000 - $150,000 annually.

Benefits
- Health insurance
- 401k match`;
    const cleaned = cleanJobPostingDescription(text);
    expect(cleaned).toMatch(/Responsibilities/);
    expect(cleaned).toMatch(/Build things/);
    expect(cleaned).toMatch(/Qualifications/);
    expect(cleaned).toMatch(/\$120,000 - \$150,000/);
    expect(cleaned).toMatch(/Benefits/);
    expect(cleaned).toMatch(/401k match/);
  });

  it("preserves title/company/location/workplace type when there is no explicit heading to slice from", () => {
    const text = "Software Engineer\nAcme Corp · Austin, TX (Remote)\n\nWe build great software and need your help.";
    const cleaned = cleanJobPostingDescription(text);
    expect(cleaned).toMatch(/Software Engineer/);
    expect(cleaned).toMatch(/Acme Corp/);
    expect(cleaned).toMatch(/Austin, TX/);
  });

  it("does not begin with logo/share/apply/save text even without a heading", () => {
    const text = "Acme Corp logo\nShare\nApply\nSave\nAcme Corp is hiring a Software Engineer to join our team.";
    const cleaned = cleanJobPostingDescription(text);
    expect(cleaned.startsWith("Acme Corp is hiring")).toBe(true);
  });
});

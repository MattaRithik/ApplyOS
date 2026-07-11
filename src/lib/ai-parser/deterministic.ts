import type { ProvenanceMap } from "@/lib/ai-parser/schema";

export interface DeterministicPartial {
  identity?: {
    requisitionId?: string | null;
    recruiterEmail?: string | null;
    sourcePlatform?: string | null;
  };
  location?: {
    workplaceType?: "remote" | "hybrid" | "onsite" | null;
  };
  compensation?: {
    salaryMinimum?: number | null;
    salaryMaximum?: number | null;
    salaryCurrency?: string | null;
  };
  roleContent?: {
    applicationDeadline?: string | null;
    postingDate?: string | null;
  };
}

export interface DeterministicOutput {
  partial: DeterministicPartial;
  provenance: ProvenanceMap;
  /** Whitespace/HTML-cleaned version of the input, used for the AI call. */
  cleanedText: string;
}

/** Strips a small set of safe HTML tags and collapses excess whitespace without touching meaningful punctuation. */
function cleanText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Sniffs the ATS/job-board platform from a job posting URL's host. */
function sniffSourcePlatform(jobUrl: string): string | null {
  try {
    const host = new URL(jobUrl).hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("greenhouse")) return "Greenhouse";
    if (host.includes("lever")) return "Lever";
    if (host.includes("workday") || host.endsWith("myworkdayjobs.com")) return "Workday";
    if (host.includes("ashbyhq")) return "Ashby";
    if (host.includes("linkedin")) return "LinkedIn";
    if (host.includes("indeed")) return "Indeed";
    if (host.includes("smartrecruiters")) return "SmartRecruiters";
    if (host.includes("icims")) return "iCIMS";
    if (host.includes("jobvite")) return "Jobvite";
    if (host.includes("taleo")) return "Taleo";
    return "Company Website";
  } catch {
    return null;
  }
}

const REQ_ID_RE = /\b(?:req(?:uisition)?\s*(?:id|#|number)?|job\s*id)[:\s#]+([A-Za-z0-9-]{3,24})\b/i;
// Matches every email in the text (global) so we can pick the one that's
// actually a recruiting contact, rather than blindly taking whichever email
// happens to appear first — postings often lead with a disability-
// accommodations, legal, or privacy contact address that is NOT the
// recruiter, and confidently mislabeling it is worse than leaving it null.
const EMAIL_RE_G = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const RECRUITING_LOCAL_PART_RE = /^(recruit|talent|hiring|careers?|jobs?|hr|people)/i;
const NON_RECRUITING_LOCAL_PART_RE =
  /(disability|accommodat|accessib|privacy|legal|compliance|noreply|no-reply|donotreply|webmaster|abuse|press|media|security|investor)/i;
const RECRUITING_CONTEXT_RE = /(recruiter|talent partner|hiring manager|point of contact|reach out|apply by email|questions? about this role)/i;

/**
 * Picks the single email in the text most likely to be a genuine recruiting
 * point-of-contact, or null if none looks safe to assume. Never a
 * best-effort guess: presence of *an* email in a posting doesn't imply it's
 * the recruiter's, and a wrong guess here actively misleads the user.
 */
function findRecruitingEmail(text: string): string | null {
  const matches = [...new Set(text.match(EMAIL_RE_G) ?? [])];
  if (matches.length === 0) return null;

  const candidates = matches.filter((email) => !NON_RECRUITING_LOCAL_PART_RE.test(email));
  if (candidates.length === 0) return null;

  const byLocalPart = candidates.find((email) => RECRUITING_LOCAL_PART_RE.test(email.split("@")[0]));
  if (byLocalPart) return byLocalPart;

  // Only one plausible email left, and it appears near recruiting-context
  // language somewhere in the posting — reasonable enough to keep.
  if (candidates.length === 1 && RECRUITING_CONTEXT_RE.test(text)) return candidates[0];

  return null;
}

const WORKPLACE_HYBRID_RE = /\bhybrid\b|\bhybrid work\b|\bdays?\s+(?:in|per week in)\s+the\s+office\b|\bdays?\s+(?:a|per)\s+week\s+(?:in|from)\b/i;
const WORKPLACE_REMOTE_RE = /\b(?:fully|100%)\s+remote\b|\bremote[-\s]first\b|\bwork from anywhere\b|\bremote position\b/i;
const WORKPLACE_ONSITE_RE = /\bon[-\s]?site\b|\bin[-\s]office\b|\bin[-\s]person\b/i;

/**
 * Scans the FULL posting (not just the top, where a title/location line
 * usually is) for explicit workplace-arrangement language. Job postings
 * often state this in a dedicated paragraph well below the fold (e.g. "Our
 * hybrid work model...") that a model skimming for a quick classification
 * can miss — this is cheap, reliable, and matches the "obvious workplace
 * keywords" deterministic signal.
 */
function detectWorkplaceType(text: string): "remote" | "hybrid" | "onsite" | null {
  // Hybrid language is checked first: postings that are hybrid often also
  // mention "in the office" or similar, which would otherwise look onsite.
  if (WORKPLACE_HYBRID_RE.test(text)) return "hybrid";
  if (WORKPLACE_REMOTE_RE.test(text)) return "remote";
  if (WORKPLACE_ONSITE_RE.test(text)) return "onsite";
  return null;
}
// Matches "$120,000 - $150,000", "$120k-$150k", "$120,000/yr - $150,000/yr", etc.
const SALARY_RANGE_RE =
  /\$\s?(\d{2,3})(?:,(\d{3})|[kK])?\s?(?:-|–|—|to)\s?\$?\s?(\d{2,3})(?:,(\d{3})|[kK])?/;
const DEADLINE_RE =
  /\b(?:deadline|apply\s+by|closes?\s+on|applications?\s+close)[:\s]+([A-Za-z]+\s\d{1,2},?\s\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/i;
const POSTED_RE =
  /\b(?:posted(?:\s+on)?|date\s+posted)[:\s]+([A-Za-z]+\s\d{1,2},?\s\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/i;

function parseSalaryToken(whole: string, thousands: string | undefined, raw: string): number {
  if (thousands) return Number(whole) * 1000 + Number(thousands);
  if (/k/i.test(raw) || Number(whole) < 400) return Number(whole) * 1000;
  return Number(whole);
}

/**
 * Narrow, high-confidence deterministic pre-pass. Only extracts values that
 * a regex/URL-sniff can get right with very low false-positive risk — this
 * output is treated as "explicit deterministic" in the merge, which sits
 * above AI-extracted values in precedence.
 */
export function runDeterministicPass(jobDescription: string, jobUrl?: string): DeterministicOutput {
  const cleanedText = cleanText(jobDescription);
  const partial: DeterministicPartial = {};
  const provenance: ProvenanceMap = {};

  const reqIdMatch = cleanedText.match(REQ_ID_RE);
  if (reqIdMatch) {
    partial.identity = { ...partial.identity, requisitionId: reqIdMatch[1] };
    provenance["identity.requisitionId"] = { status: "explicit", evidence: reqIdMatch[0].slice(0, 200) };
  }

  const recruitingEmail = findRecruitingEmail(cleanedText);
  if (recruitingEmail) {
    partial.identity = { ...partial.identity, recruiterEmail: recruitingEmail };
    provenance["identity.recruiterEmail"] = { status: "explicit", evidence: recruitingEmail };
  }

  const workplaceType = detectWorkplaceType(cleanedText);
  if (workplaceType) {
    partial.location = { workplaceType };
    provenance["location.workplaceType"] = { status: "explicit", evidence: workplaceType };
  }

  if (jobUrl) {
    const platform = sniffSourcePlatform(jobUrl);
    if (platform) {
      partial.identity = { ...partial.identity, sourcePlatform: platform };
      provenance["identity.sourcePlatform"] = { status: "normalized", evidence: jobUrl.slice(0, 200) };
    }
  }

  const salaryMatch = cleanedText.match(SALARY_RANGE_RE);
  if (salaryMatch) {
    const min = parseSalaryToken(salaryMatch[1], salaryMatch[2], salaryMatch[0]);
    const max = parseSalaryToken(salaryMatch[3], salaryMatch[4], salaryMatch[0]);
    if (min > 0 && max > 0 && max >= min) {
      const currency = /\bCAD\b/.test(cleanedText) ? "CAD" : /\bGBP|£/.test(cleanedText) ? "GBP" : /\bEUR|€/.test(cleanedText) ? "EUR" : "USD";
      partial.compensation = { salaryMinimum: min, salaryMaximum: max, salaryCurrency: currency };
      provenance["compensation.salaryMinimum"] = { status: "explicit", evidence: salaryMatch[0].slice(0, 200) };
      provenance["compensation.salaryMaximum"] = { status: "explicit", evidence: salaryMatch[0].slice(0, 200) };
      provenance["compensation.salaryCurrency"] = { status: "normalized", evidence: salaryMatch[0].slice(0, 200) };
    }
  }

  const deadlineMatch = cleanedText.match(DEADLINE_RE);
  if (deadlineMatch) {
    partial.roleContent = { ...partial.roleContent, applicationDeadline: deadlineMatch[1] };
    provenance["roleContent.applicationDeadline"] = { status: "explicit", evidence: deadlineMatch[0].slice(0, 200) };
  }

  const postedMatch = cleanedText.match(POSTED_RE);
  if (postedMatch) {
    partial.roleContent = { ...partial.roleContent, postingDate: postedMatch[1] };
    provenance["roleContent.postingDate"] = { status: "explicit", evidence: postedMatch[0].slice(0, 200) };
  }

  return { partial, provenance, cleanedText };
}

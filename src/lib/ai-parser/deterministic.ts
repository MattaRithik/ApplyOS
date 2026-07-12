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
function sniffSourcePlatformFromUrl(jobUrl: string): string | null {
  try {
    const host = new URL(jobUrl).hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("greenhouse")) return "Greenhouse";
    if (host.includes("lever")) return "Lever";
    if (host.includes("workday") || host.endsWith("myworkdayjobs.com")) return "Workday";
    if (host.includes("ashbyhq")) return "Ashby";
    if (host.includes("linkedin")) return "LinkedIn";
    if (host.includes("indeed")) return "Indeed";
    if (host.includes("glassdoor")) return "Glassdoor";
    if (host.includes("joinhandshake") || host.includes("handshake")) return "Handshake";
    if (host.includes("ripplematch")) return "RippleMatch";
    if (host.includes("wayup")) return "WayUp";
    if (host.includes("smartrecruiters")) return "SmartRecruiters";
    if (host.includes("icims")) return "iCIMS";
    if (host.includes("jobvite")) return "Jobvite";
    if (host.includes("taleo")) return "Taleo";
    if (host.includes("successfactors")) return "SuccessFactors";
    if (host.includes("eightfold")) return "Eightfold";
    if (host.includes("ziprecruiter")) return "ZipRecruiter";
    if (host.includes("monster")) return "Monster";
    if (host.includes("dice.com")) return "Dice";
    if (host.includes("efinancialcareers")) return "eFinancialCareers";
    if (host.includes("builtin.com")) return "Built In";
    if (host.includes("oraclecloud") || host.includes("oracle")) return "Oracle Cloud Careers";
    return "Company Website";
  } catch {
    return null;
  }
}

/**
 * Portal-specific copied-page phrases that reliably signal a source platform
 * even when the user pasted plain text with no URL at all — e.g. LinkedIn's
 * "Responses managed off LinkedIn" or "Your AI-powered job assessment" never
 * appear verbatim outside a LinkedIn job page. Checked in order; the first
 * match wins, and footer/legal/social boilerplate is deliberately excluded
 * from the phrase lists so it can't outrank the real posting source.
 */
const TEXT_SOURCE_PLATFORM_SIGNALS: { platform: string; pattern: RegExp }[] = [
  {
    platform: "LinkedIn",
    pattern:
      /responses managed off linkedin|promoted by hirer|your ai-powered job assessment|show match details|tailor my resume|help me stand out|people you can reach out to|company alumni from|\d+\s+people clicked apply|easy apply on linkedin/i,
  },
  { platform: "Indeed", pattern: /posted on indeed|apply on indeed|indeed\.com|indeed job/i },
  { platform: "Glassdoor", pattern: /glassdoor/i },
  { platform: "Handshake", pattern: /joinhandshake|\bhandshake\b/i },
  { platform: "RippleMatch", pattern: /ripplematch/i },
  { platform: "WayUp", pattern: /\bwayup\b/i },
  { platform: "Greenhouse", pattern: /greenhouse job board|powered by greenhouse|boards\.greenhouse/i },
  { platform: "Lever", pattern: /jobs\.lever\.co|powered by lever/i },
  { platform: "Workday", pattern: /workday careers|myworkdayjobs/i },
  { platform: "Ashby", pattern: /jobs\.ashbyhq|ashby job board/i },
  { platform: "SmartRecruiters", pattern: /smartrecruiters/i },
  { platform: "Taleo", pattern: /\btaleo\b/i },
  { platform: "iCIMS", pattern: /\bicims\b/i },
  { platform: "Oracle Cloud Careers", pattern: /oracle cloud (recruiting|careers)/i },
  { platform: "SuccessFactors", pattern: /successfactors/i },
  { platform: "Eightfold", pattern: /\beightfold\b/i },
  { platform: "ZipRecruiter", pattern: /ziprecruiter/i },
  { platform: "Monster", pattern: /monster\.com|posted on monster/i },
  { platform: "Dice", pattern: /dice\.com|posted on dice/i },
  { platform: "eFinancialCareers", pattern: /efinancialcareers/i },
  { platform: "Built In", pattern: /builtin\.com/i },
];

/**
 * Detects the source job portal from plain copied page text — company
 * logo/name blocks, "Apply"/"Save" chip labels, and generic navigation are
 * never enough signal on their own; only portal-specific phrases (see the
 * list above) are matched, so an employer's name is never confused with the
 * platform it was posted on.
 */
function detectSourcePlatformFromText(text: string): { platform: string; evidence: string } | null {
  for (const { platform, pattern } of TEXT_SOURCE_PLATFORM_SIGNALS) {
    const match = text.match(pattern);
    if (match) return { platform, evidence: match[0].slice(0, 200) };
  }
  return null;
}

// Conservative: only URLs that look like an actual job POSTING (a known ATS
// host, or a path containing a job/career keyword) are ever auto-filled —
// footer/legal/social/accommodation links that happen to be pasted alongside
// the posting text must never be mistaken for the job URL itself.
const URL_RE = /https?:\/\/[^\s<>"')]+/gi;
const JOB_POSTING_HOST_RE =
  /(linkedin\.com|indeed\.com|glassdoor\.com|joinhandshake\.com|ripplematch\.com|wayup\.com|greenhouse\.io|lever\.co|myworkdayjobs\.com|ashbyhq\.com|smartrecruiters\.com|icims\.com|jobvite\.com|taleo\.net|successfactors\.com|eightfold\.ai|ziprecruiter\.com|monster\.com|dice\.com|efinancialcareers\.com|builtin\.com)/i;
const JOB_POSTING_PATH_RE = /\/(jobs?|careers?|job-postings?|postings?|viewjob|opening)\b/i;
const NON_JOB_HOST_RE = /(facebook\.com|twitter\.com|x\.com|instagram\.com|tiktok\.com|youtube\.com|eeoc\.gov)/i;
// LinkedIn people/company profile pages (not a job posting) so a pasted
// "reach out to your network" section doesn't get mistaken for the job link.
const LINKEDIN_NON_JOB_PATH_RE = /linkedin\.com\/(in|company|school)\//i;

/**
 * Finds an actual job-posting URL literally present in pasted text, or null.
 * Never invented — only returned when a candidate URL both parses as safe
 * http(s) and looks like a genuine posting link (known ATS host, or a
 * job/career path segment), never a social/legal/profile link that happens
 * to be pasted nearby.
 */
export function extractLikelyJobPostingUrl(text: string): string | null {
  const matches = text.match(URL_RE) ?? [];
  for (const raw of matches) {
    const candidate = raw.replace(/[.,;:!?)]+$/, "");
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      continue;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
    if (NON_JOB_HOST_RE.test(parsed.hostname)) continue;
    if (LINKEDIN_NON_JOB_PATH_RE.test(candidate)) continue;
    if (JOB_POSTING_HOST_RE.test(parsed.hostname) || JOB_POSTING_PATH_RE.test(parsed.pathname)) {
      return parsed.toString();
    }
  }
  return null;
}

const REQ_ID_RE = /\b(?:req(?:uisition)?\s*(?:id|#|number)?|job\s*id)[:\s#]+([A-Za-z0-9-]{3,24})\b/i;
// Matches every email in the text (global) so we can pick the one that's
// actually a recruiting contact, rather than blindly taking whichever email
// happens to appear first — postings often lead with a disability-
// accommodations, legal, or privacy contact address that is NOT the
// recruiter, and confidently mislabeling it is worse than leaving it null.
const EMAIL_RE_G = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Only strong, dedicated recruiting-team local parts count as a positive
// signal — "careers@"/"jobs@"/"hr@"/"people@" are usually generic automated
// distribution lists, not a real recruiter's inbox, so they're excluded
// below rather than treated as a match.
const RECRUITING_LOCAL_PART_RE = /^(recruit|talent)/i;
const NON_RECRUITING_LOCAL_PART_SUBSTRING_RE =
  /(disability|accommodat|accessib|privacy|legal|compliance|noreply|no-reply|donotreply|webmaster|abuse|press|media|security|investor|support|help)/i;
const NON_RECRUITING_LOCAL_PART_EXACT = new Set([
  "careers",
  "career",
  "jobs",
  "job",
  "hr",
  "info",
  "hello",
  "contact",
  "admin",
  "office",
  "team",
  "people",
]);
const RECRUITING_CONTEXT_RE = /(recruiter|talent partner|hiring manager|point of contact|reach out|apply by email|questions? about this role)/i;

function isNonRecruitingLocalPart(localPart: string): boolean {
  const lower = localPart.toLowerCase();
  if (NON_RECRUITING_LOCAL_PART_EXACT.has(lower)) return true;
  return NON_RECRUITING_LOCAL_PART_SUBSTRING_RE.test(lower);
}

/**
 * Picks the single email in the text most likely to be a genuine recruiting
 * point-of-contact, or null if none looks safe to assume. Never a
 * best-effort guess: presence of *an* email in a posting doesn't imply it's
 * the recruiter's, and a wrong guess here actively misleads the user.
 * Generic/automated mailboxes (careers@, jobs@, hr@, info@, support@, etc.)
 * and known non-recruiting addresses (accommodations, legal, privacy,
 * press, compliance) are never treated as a recruiter contact.
 */
function findRecruitingEmail(text: string): string | null {
  const matches = [...new Set(text.match(EMAIL_RE_G) ?? [])];
  if (matches.length === 0) return null;

  const candidates = matches.filter((email) => !isNonRecruitingLocalPart(email.split("@")[0]));
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

  // A real posting URL (if one was supplied) is the most reliable signal;
  // fall back to portal-specific copied-text phrases only when no URL was
  // given, so the actual posting source wins over incidental text mentions.
  if (jobUrl) {
    const platform = sniffSourcePlatformFromUrl(jobUrl);
    if (platform) {
      partial.identity = { ...partial.identity, sourcePlatform: platform };
      provenance["identity.sourcePlatform"] = { status: "normalized", evidence: jobUrl.slice(0, 200) };
    }
  } else {
    const textSignal = detectSourcePlatformFromText(cleanedText);
    if (textSignal) {
      partial.identity = { ...partial.identity, sourcePlatform: textSignal.platform };
      provenance["identity.sourcePlatform"] = { status: "explicit", evidence: textSignal.evidence };
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

// ---------------------------------------------------------------------
// Deterministic description cleanup.
//
// Job postings copied from LinkedIn/Indeed/etc. carry a lot of page chrome
// ahead of the real content — logo captions, Apply/Save/Share buttons,
// "Your AI-powered job assessment", alumni-network callouts, and repeated
// title/company/location blocks. The AI extraction step still sees the
// full raw text (that clutter is actually useful signal for source-platform
// detection), but the description that gets SAVED to the application
// should read like a normal job posting, not a scraped page dump.
// ---------------------------------------------------------------------

const CONTENT_HEADING_RE = /^(about (the )?(job|role|this role|position|team)|job description|the role|role overview|position summary|overview)\s*:?\s*$/i;

// Full-line (after trim) junk patterns — page chrome, portal AI features,
// social/network callouts, and applicant-count/promotion boilerplate. These
// are checked against a whole line, not a substring of a paragraph, so a
// legitimate sentence that happens to contain the word "apply" is untouched.
const JUNK_LINE_RES: RegExp[] = [
  /logo$/i,
  /^share$/i,
  /^show more options$/i,
  /^apply$/i,
  /^save$/i,
  /^save\s+.+/i, // "Save Quantitative Trader / Researcher - US at Tower Research Capital"
  /^easy apply$/i,
  /^sign in$/i,
  /^sign up$/i,
  /^join now$/i,
  /^connect$/i,
  /^follow$/i,
  /^message$/i,
  /your ai-powered job assessment/i,
  /show match details/i,
  /tailor my resume/i,
  /create cover letter/i,
  /help me stand out/i,
  /people you can reach out to/i,
  /company alumni from/i,
  /responses managed off linkedin/i,
  /^promoted by hirer/i,
  /^reposted\b/i,
  /over\s+\d+\s+people\s+clicked\s+apply/i,
  /^\d+\s+people\s+clicked\s+apply/i,
  /clicked apply$/i,
  /^\d+\s+applicants?$/i,
  /^see who.*hired/i,
  /^see how you (compare|match)/i,
];

function isJunkLine(line: string): boolean {
  return JUNK_LINE_RES.some((re) => re.test(line));
}

/**
 * Deterministically strips portal page-chrome from a pasted job posting so
 * the version saved to the application reads like a real job description.
 * Prefers slicing from an explicit "About the job"-style heading (which
 * drops essentially all header clutter — logo, Apply/Save chips, AI
 * assessment upsells, alumni network callouts — in one step); when no such
 * heading exists, falls back to per-line junk filtering plus dedup of
 * short repeated chip/title/company lines across the whole text.
 */
export function cleanJobPostingDescription(rawText: string): string {
  const normalized = cleanText(rawText);
  const lines = normalized.split("\n");

  let headingIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (CONTENT_HEADING_RE.test(lines[i].trim())) {
      headingIdx = i;
      break;
    }
  }
  const candidateLines = headingIdx >= 0 ? lines.slice(headingIdx) : lines;

  const seenShortLines = new Set<string>();
  const kept: string[] = [];
  for (const rawLine of candidateLines) {
    const line = rawLine.trim();
    if (!line) {
      kept.push("");
      continue;
    }
    if (isJunkLine(line)) continue;
    // Dedupe short repeated lines (chips/title/company blocks that appear
    // more than once in the copied page) — long paragraph sentences are
    // never deduped, since legitimate content can repeat a phrase.
    if (line.length < 120) {
      const key = line.toLowerCase();
      if (seenShortLines.has(key)) continue;
      seenShortLines.add(key);
    }
    kept.push(line);
  }

  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

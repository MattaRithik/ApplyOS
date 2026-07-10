import { addDays, format, isWeekend } from "date-fns";
import { FINANCE_ROLE_CATEGORIES, type JobExtraction, type JobIntelligence } from "@/lib/parser/schema";

type FinanceRoleCategory = (typeof FINANCE_ROLE_CATEGORIES)[number];
import {
  PROGRAMMING_LANGUAGES,
  TECHNOLOGIES,
  FINANCE_SKILLS,
  ML_AI_SKILLS,
  SOFT_SKILLS,
  ALL_SKILLS,
  extractSkillsFromLibrary,
  classifyFinanceRoleCategory,
  suggestTags,
} from "@/lib/parser/skills";
import { classifyVisaStatus } from "@/lib/parser/visa";

const REQUIRED_MARKERS = ["required", "must have", "requirements", "you have", "minimum qualifications"];
const PREFERRED_MARKERS = ["preferred", "nice to have", "bonus", "plus", "ideally"];
const RESPONSIBILITY_MARKERS = ["responsibilities", "what you'll do", "what you will do", "the role"];
const QUALIFICATION_MARKERS = ["qualifications", "requirements", "who you are"];
const PREFERRED_QUAL_MARKERS = ["preferred qualifications", "nice to have"];

function findSection(text: string, markers: string[], windowChars = 700): string {
  const lower = text.toLowerCase();
  for (const marker of markers) {
    const idx = lower.indexOf(marker);
    if (idx !== -1) return text.slice(idx, idx + windowChars);
  }
  return "";
}

/** Pulls bullet-like lines out of a section (handles -, *, •, and numbered lists). */
function extractBullets(section: string, max = 8): string[] {
  if (!section) return [];
  return section
    .split("\n")
    .map((l) => l.replace(/^[\s\-*•\d.)]+/, "").trim())
    .filter((l) => l.length > 12 && l.length < 220)
    .slice(0, max);
}

function nextBusinessDay(date: Date): Date {
  let d = date;
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
}

export interface HeuristicOutput {
  extraction: JobExtraction;
  intelligence: JobIntelligence;
  tags: string[];
  financeCategory: string | null;
}

export function parseJobDescriptionHeuristic(jobDescription: string, jobUrl?: string): HeuristicOutput {
  const text = jobDescription || "";
  const extraction: JobExtraction = {};

  const asField = <T,>(value: T, confidence: number) => ({ value, confidence, source: "heuristic" as const });

  // --- Company ---
  let companyGuess: string | undefined;
  let companyConfidence = 40;
  let jobBoard: string | undefined;
  if (jobUrl) {
    try {
      const u = new URL(jobUrl);
      const host = u.hostname.replace("www.", "");
      const seg = u.pathname.split("/").filter(Boolean);
      if (host.includes("greenhouse") || host.includes("lever") || host.includes("workday") || host.includes("ashbyhq")) {
        // These boards are reached either as {company}.example.com/... (subdomain)
        // or example.com/{company}/... (path) — try the subdomain first, since a
        // generic one like "boards"/"jobs" means the company is the first path segment instead.
        const subdomain = host.split(".")[0];
        const genericSubdomains = ["boards", "job-boards", "jobs", "www", "app", "careers"];
        const genericSegments = ["jobs", "job", "careers", "posting", "postings", "position"];
        if (subdomain && !genericSubdomains.includes(subdomain)) {
          companyGuess = subdomain.replace(/[-_]/g, " ");
          companyConfidence = 70;
        } else {
          const companySeg = seg.find((s) => !genericSegments.includes(s.toLowerCase()) && !/^\d+$/.test(s));
          companyGuess = companySeg?.replace(/[-_]/g, " ");
          companyConfidence = 60;
        }
      } else if (!host.includes("linkedin") && !host.includes("indeed")) {
        companyGuess = host.split(".")[0];
        companyConfidence = 45;
      }
      if (host.includes("linkedin")) jobBoard = "LinkedIn";
      else if (host.includes("indeed")) jobBoard = "Indeed";
      else if (host.includes("greenhouse")) jobBoard = "Greenhouse";
      else if (host.includes("lever")) jobBoard = "Lever";
      else if (host.includes("workday")) jobBoard = "Workday";
      else if (host.includes("ashbyhq")) jobBoard = "Ashby";
      else jobBoard = "Company Website";
    } catch {
      /* not a valid URL */
    }
  }
  if (!companyGuess) {
    const atMatch = text.match(/\bat\s+([A-Z][A-Za-z0-9&.,' ]{1,40})\b/);
    if (atMatch) {
      companyGuess = atMatch[1].trim();
      companyConfidence = 55;
    }
  }
  if (companyGuess) {
    extraction.companyName = asField(companyGuess.replace(/\b\w/g, (c) => c.toUpperCase()), companyConfidence);
  }
  if (jobBoard) extraction.jobBoard = asField(jobBoard, 90);

  const websiteMatch = text.match(/\bhttps?:\/\/(?!.*linkedin)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s)]*)?/);
  if (websiteMatch) extraction.companyWebsite = asField(websiteMatch[0], 50);

  const linkedInMatch = text.match(/https?:\/\/(?:www\.)?linkedin\.com\/company\/[a-zA-Z0-9-]+/i);
  if (linkedInMatch) extraction.companyLinkedInUrl = asField(linkedInMatch[0], 80);

  // --- Job title ---
  const firstLines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 5);
  const titleLine = firstLines.find((l) =>
    l.length < 90 &&
    /engineer|manager|analyst|scientist|designer|intern|associate|director|specialist|coordinator|lead|consultant|trader|researcher/i.test(l)
  );
  if (titleLine) extraction.jobTitle = asField(titleLine.replace(/[-–—]\s*$/, "").trim(), 60);

  // --- Department ---
  const deptMatch = text.match(/\b(department|team)[:\s]+([A-Z][A-Za-z &]{2,40})/i);
  if (deptMatch) extraction.department = asField(deptMatch[2].trim(), 55);

  // --- Role category (finance-aware) ---
  const financeCategory = classifyFinanceRoleCategory(`${titleLine ?? ""} ${text}`);
  if (financeCategory) {
    extraction.roleCategory = asField(financeCategory as FinanceRoleCategory, 65);
  }

  // --- Work mode / employment type ---
  if (/\bremote\b/i.test(text)) extraction.workMode = asField("remote", 85);
  else if (/\bhybrid\b/i.test(text)) extraction.workMode = asField("hybrid", 85);
  else if (/\bon[-\s]?site\b/i.test(text)) extraction.workMode = asField("onsite", 80);

  if (/\bintern(ship)?\b/i.test(text)) extraction.employmentType = asField("internship", 85);
  else if (/\bcontract(or)?\b/i.test(text)) extraction.employmentType = asField("contract", 75);
  else if (/\bpart[-\s]?time\b/i.test(text)) extraction.employmentType = asField("part_time", 80);
  else if (/\bfull[-\s]?time\b/i.test(text)) extraction.employmentType = asField("full_time", 80);

  // --- Locations ---
  const locationMatches = [...text.matchAll(/\b([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)?,\s?[A-Z]{2}(?:,\s?(?:USA|United States))?)\b/g)]
    .map((m) => m[1])
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 5);
  if (locationMatches.length) extraction.locations = asField(locationMatches, 70);

  // --- Salary ---
  const salaryMatch = text.match(/\$\s?(\d{2,3})(?:,(\d{3})|k)?\s?-\s?\$?\s?(\d{2,3})(?:,(\d{3})|k)?/i);
  if (salaryMatch) {
    const toNum = (whole: string, thousands?: string, hasK?: boolean) => {
      if (thousands) return Number(whole) * 1000 + Number(thousands);
      if (hasK || Number(whole) < 400) return Number(whole) * 1000;
      return Number(whole);
    };
    const min = toNum(salaryMatch[1], salaryMatch[2], /k/i.test(salaryMatch[0]));
    const max = toNum(salaryMatch[3], salaryMatch[4], /k/i.test(salaryMatch[0]));
    extraction.salaryMin = asField(min, 80);
    extraction.salaryMax = asField(max, 80);
    extraction.currency = asField(/\bCAD\b/.test(text) ? "CAD" : /\bGBP|£/.test(text) ? "GBP" : "USD", 60);
  }

  // --- Education / experience ---
  const eduMatch = text.match(/\b(Bachelor'?s|Master'?s|PhD|Ph\.D\.|B\.?S\.?|M\.?S\.?|MBA)\b[^.\n]{0,60}/i);
  if (eduMatch) extraction.education = asField(eduMatch[0].trim(), 65);

  const yearsMatch = text.match(/(\d{1,2}\+?\s?-?\s?\d{0,2}\+?\s?years?)(\s+of)?\s+(experience|exp)/i);
  if (yearsMatch) extraction.experience = asField(yearsMatch[1].trim(), 75);

  // --- Deadline / job ID ---
  const deadlineMatch = text.match(/(deadline|apply by|closes on)[:\s]+([A-Za-z]+\s\d{1,2},?\s\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (deadlineMatch) extraction.deadline = asField(deadlineMatch[2], 65);

  const jobIdMatch = text.match(/\b(job\s*id|req(?:uisition)?\s*(?:id|#|number))[:\s#]+([A-Za-z0-9-]{3,20})/i);
  if (jobIdMatch) extraction.jobId = asField(jobIdMatch[2], 75);

  // --- Recruiter ---
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) extraction.recruiterEmail = asField(emailMatch[0], 80);
  const recruiterNameMatch = text.match(/\b(recruiter|hiring manager|talent partner)[:\s]+([A-Z][a-zA-Z]+\s[A-Z][a-zA-Z]+)/i);
  if (recruiterNameMatch) extraction.recruiterName = asField(recruiterNameMatch[2], 70);

  // --- Skills (categorized) ---
  const requiredSection = findSection(text, REQUIRED_MARKERS) || text;
  const preferredSection = findSection(text, PREFERRED_MARKERS);
  const requiredSkills = extractSkillsFromLibrary(requiredSection, ALL_SKILLS);
  const preferredSkills = extractSkillsFromLibrary(preferredSection, ALL_SKILLS).filter((s) => !requiredSkills.includes(s));
  if (requiredSkills.length) extraction.requiredSkills = asField(requiredSkills, 70);
  if (preferredSkills.length) extraction.preferredSkills = asField(preferredSkills, 55);

  const programmingLanguages = extractSkillsFromLibrary(text, PROGRAMMING_LANGUAGES);
  if (programmingLanguages.length) extraction.programmingLanguages = asField(programmingLanguages, 75);

  const technologies = extractSkillsFromLibrary(text, TECHNOLOGIES);
  if (technologies.length) extraction.technologies = asField(technologies, 70);

  const financeSkills = extractSkillsFromLibrary(text, [...FINANCE_SKILLS, ...ML_AI_SKILLS]);
  if (financeSkills.length) extraction.financeSkills = asField(financeSkills, 65);

  const softSkills = extractSkillsFromLibrary(text, SOFT_SKILLS);
  if (softSkills.length) extraction.softSkills = asField(softSkills, 55);

  const allDetectedSkills = extractSkillsFromLibrary(text, ALL_SKILLS);
  if (allDetectedSkills.length) extraction.keywords = asField([...new Set(allDetectedSkills)], 65);

  // --- Content sections ---
  const responsibilities = extractBullets(findSection(text, RESPONSIBILITY_MARKERS));
  if (responsibilities.length) extraction.responsibilities = asField(responsibilities, 60);

  const qualifications = extractBullets(findSection(text, QUALIFICATION_MARKERS));
  if (qualifications.length) extraction.qualifications = asField(qualifications, 55);

  const preferredQualifications = extractBullets(findSection(text, PREFERRED_QUAL_MARKERS));
  if (preferredQualifications.length) extraction.preferredQualifications = asField(preferredQualifications, 50);

  // --- Summary ---
  const paragraph = text.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p.length > 120);
  if (paragraph) extraction.jobSummary = asField(paragraph.slice(0, 500), 55);

  // --- Visa (never guess) ---
  const visa = classifyVisaStatus(text);
  extraction.visaStatus = asField(visa.status, visa.confidence);

  // --- Tags / finance category ---
  const tags = suggestTags(text);

  // --- Baseline intelligence (resume-independent) ---
  const intelligence: JobIntelligence = {};

  const requiredCount = requiredSkills.length + programmingLanguages.length + financeSkills.length;
  const yearsNum = yearsMatch ? Number(yearsMatch[1].match(/\d+/)?.[0] ?? 0) : 0;
  intelligence.estimatedDifficulty =
    yearsNum >= 6 || requiredCount >= 10 ? "very_high" : yearsNum >= 3 || requiredCount >= 6 ? "high" : requiredCount >= 3 ? "medium" : "low";

  let priority = 50;
  if (visa.status === "h1b_available" || visa.status === "opt_accepted" || visa.status === "cpt_accepted") priority += 15;
  if (visa.status === "no_sponsorship") priority -= 15;
  if (extraction.salaryMin) priority += 10;
  if (extraction.workMode?.value === "remote") priority += 10;
  if (financeCategory) priority += 5;
  intelligence.priorityScore = Math.max(0, Math.min(priority, 100));

  intelligence.applicationSuccessScore = Math.max(0, Math.min(intelligence.priorityScore - (requiredCount >= 8 ? 10 : 0), 100));
  intelligence.successScoreReason = [
    visa.status === "no_sponsorship" ? "No visa sponsorship lowers accessibility." : null,
    extraction.salaryMin ? "Salary transparency is a positive signal." : null,
    requiredCount >= 8 ? "A long required-skills list raises the bar for a strong match." : null,
    financeCategory ? `Role maps cleanly to the ${financeCategory} category.` : null,
  ].filter(Boolean).join(" ") || "Baseline estimate from posting content alone — refine once a resume is attached.";

  intelligence.estimatedCompetition = financeCategory && /Quant|Investment Banking|Hedge Fund|Private Equity/.test(financeCategory) ? "very_high" : "medium";
  intelligence.companyPrestigeScore = 50; // unknown without external data — neutral baseline, low confidence upstream
  intelligence.networkingOpportunityScore = extraction.recruiterEmail || extraction.recruiterName || extraction.companyLinkedInUrl ? 70 : 40;
  intelligence.estimatedSalaryConfidence = extraction.salaryMin ? "high" : "low";

  const followUp = nextBusinessDay(addDays(new Date(), 7));
  intelligence.suggestedFollowUpDate = format(followUp, "yyyy-MM-dd");

  intelligence.suggestedResumeVersion = financeCategory
    ? `${financeCategory}-focused resume`
    : "General resume";
  intelligence.suggestedCoverLetterFocus = financeCategory
    ? `Lead with quantitative/${financeCategory.toLowerCase()} project experience and any relevant coursework or certifications.`
    : "Lead with your most relevant project or work experience for this role.";
  intelligence.suggestedColdEmailAngle = extraction.companyName
    ? `Reference a specific, recent initiative at ${extraction.companyName.value} and tie it to your background.`
    : "Reference a specific, recent company initiative and tie it to your background.";
  intelligence.suggestedLinkedInMessage = extraction.recruiterName
    ? `Hi ${extraction.recruiterName.value.split(" ")[0]}, I just applied for the ${extraction.jobTitle?.value ?? "role"} — would love to connect and learn more about the team.`
    : `Hi, I just applied for the ${extraction.jobTitle?.value ?? "role"} at ${extraction.companyName?.value ?? "your company"} — would love to connect.`;
  intelligence.suggestedInterviewTopics = [
    ...(financeCategory ? [financeCategory] : []),
    ...requiredSkills.slice(0, 4),
  ].slice(0, 6);

  return { extraction, intelligence, tags, financeCategory };
}

import { addDays, format } from "date-fns";
import type { ParsedJobResult } from "@/lib/parser/types";

const SKILL_LIBRARY = [
  "Python", "Java", "JavaScript", "TypeScript", "C++", "C#", "Go", "Rust", "Swift", "Kotlin",
  "SQL", "NoSQL", "React", "Next.js", "Vue", "Angular", "Node.js", "Express", "Django", "Flask",
  "Spring", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "CI/CD", "Git",
  "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "Pandas", "NumPy", "Spark",
  "Hadoop", "Airflow", "Kafka", "REST", "GraphQL", "Microservices", "Excel", "PowerPoint",
  "Salesforce", "Tableau", "Power BI", "R", "MATLAB", "Agile", "Scrum", "Linux",
  "System Design", "Data Structures", "Algorithms", "Financial Modeling", "Valuation",
  "Communication", "Leadership", "Project Management",
];

const REQUIRED_MARKERS = ["required", "must have", "requirements", "you have", "minimum qualifications"];
const PREFERRED_MARKERS = ["preferred", "nice to have", "bonus", "plus", "ideally"];

function findSection(text: string, markers: string[], windowChars = 600): string {
  const lower = text.toLowerCase();
  for (const marker of markers) {
    const idx = lower.indexOf(marker);
    if (idx !== -1) return text.slice(idx, idx + windowChars);
  }
  return "";
}

function extractSkillsFrom(section: string): string[] {
  return SKILL_LIBRARY.filter((skill) => new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(section));
}

export function parseJobDescriptionHeuristic(jobDescription: string, jobUrl?: string): ParsedJobResult {
  const text = jobDescription || "";
  const result: ParsedJobResult = {};

  // Company: try URL path, else "at {Company}" pattern, else first capitalized line.
  let companyGuess: string | undefined;
  let companyConfidence = 40;
  if (jobUrl) {
    try {
      const u = new URL(jobUrl);
      const host = u.hostname.replace("www.", "");
      const seg = u.pathname.split("/").filter(Boolean);
      if (host.includes("greenhouse") || host.includes("lever") || host.includes("workday")) {
        companyGuess = seg[0]?.replace(/[-_]/g, " ");
        companyConfidence = 65;
      } else if (!host.includes("linkedin") && !host.includes("indeed")) {
        companyGuess = host.split(".")[0];
        companyConfidence = 45;
      }
    } catch {
      /* not a valid URL, ignore */
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
    result.company = {
      value: companyGuess.replace(/\b\w/g, (c) => c.toUpperCase()),
      confidence: companyConfidence,
    };
  }

  // Job title: first non-empty line under ~80 chars often is the title.
  const firstLines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 5);
  const titleLine = firstLines.find((l) => l.length < 90 && /engineer|manager|analyst|scientist|designer|intern|associate|director|specialist|coordinator|lead|consultant/i.test(l));
  if (titleLine) {
    result.jobTitle = { value: titleLine.replace(/[-–—]\s*$/, "").trim(), confidence: 60 };
  }

  // Work mode
  if (/\bremote\b/i.test(text)) result.workMode = { value: "remote", confidence: 85 };
  else if (/\bhybrid\b/i.test(text)) result.workMode = { value: "hybrid", confidence: 85 };
  else if (/\bon[-\s]?site\b/i.test(text)) result.workMode = { value: "onsite", confidence: 80 };

  // Employment type
  if (/\bintern(ship)?\b/i.test(text)) result.employmentType = { value: "internship", confidence: 85 };
  else if (/\bcontract(or)?\b/i.test(text)) result.employmentType = { value: "contract", confidence: 75 };
  else if (/\bpart[-\s]?time\b/i.test(text)) result.employmentType = { value: "part_time", confidence: 80 };
  else if (/\bfull[-\s]?time\b/i.test(text)) result.employmentType = { value: "full_time", confidence: 80 };

  // Location
  const locMatch = text.match(/\b([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)?,\s?[A-Z]{2}(?:,\s?(?:USA|United States))?)\b/);
  if (locMatch) result.location = { value: locMatch[1], confidence: 70 };

  // Salary range
  const salaryMatch = text.match(/\$\s?\d{2,3}(?:,\d{3}|k)?\s?-\s?\$?\s?\d{2,3}(?:,\d{3}|k)?/i);
  if (salaryMatch) result.salaryRange = { value: salaryMatch[0].replace(/\s+/g, ""), confidence: 90 };

  // Education
  const eduMatch = text.match(/\b(Bachelor'?s|Master'?s|PhD|Ph\.D\.|B\.?S\.?|M\.?S\.?|MBA)\b[^.\n]{0,60}/i);
  if (eduMatch) result.education = { value: eduMatch[0].trim(), confidence: 65 };

  // Years of experience
  const yearsMatch = text.match(/(\d{1,2}\+?\s?-?\s?\d{0,2}\+?\s?years?)(\s+of)?\s+(experience|exp)/i);
  if (yearsMatch) result.yearsExperience = { value: yearsMatch[1].trim(), confidence: 75 };

  // Visa notes
  const visaMatch = text.match(/[^.\n]*\b(H1B|H-1B|OPT|CPT|sponsor(?:ship)?|visa|work authorization)\b[^.\n]*/i);
  if (visaMatch) result.visaNotes = { value: visaMatch[0].trim(), confidence: 70 };

  // Deadline
  const deadlineMatch = text.match(/(deadline|apply by|closes on)[:\s]+([A-Za-z]+\s\d{1,2},?\s\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (deadlineMatch) result.deadline = { value: deadlineMatch[2], confidence: 65 };

  // Recruiter/HR info
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) result.recruiterInfo = { value: emailMatch[0], confidence: 80 };

  // Required / preferred skills
  const requiredSection = findSection(text, REQUIRED_MARKERS) || text;
  const preferredSection = findSection(text, PREFERRED_MARKERS);
  const requiredSkills = extractSkillsFrom(requiredSection);
  const preferredSkills = extractSkillsFrom(preferredSection).filter((s) => !requiredSkills.includes(s));
  if (requiredSkills.length) result.requiredSkills = { value: requiredSkills, confidence: 70 };
  if (preferredSkills.length) result.preferredSkills = { value: preferredSkills, confidence: 55 };

  // Keywords: union of all detected skills + role type words
  const allSkills = extractSkillsFrom(text);
  if (allSkills.length) result.keywords = { value: [...new Set(allSkills)], confidence: 65 };

  // Role type — crude classification from title/text
  const roleTypeMap: [RegExp, string][] = [
    [/data scien/i, "Data Science"],
    [/machine learning|\bML\b/i, "Machine Learning"],
    [/frontend|front-end/i, "Frontend Engineering"],
    [/backend|back-end/i, "Backend Engineering"],
    [/full[-\s]?stack/i, "Full-Stack Engineering"],
    [/product manager/i, "Product Management"],
    [/design/i, "Design"],
    [/sales/i, "Sales"],
    [/marketing/i, "Marketing"],
    [/finance|investment|analyst/i, "Finance"],
    [/software engineer/i, "Software Engineering"],
  ];
  const roleTypeHit = roleTypeMap.find(([re]) => re.test(text));
  if (roleTypeHit) result.roleType = { value: roleTypeHit[1], confidence: 60 };

  // Job summary: first real paragraph
  const paragraph = text.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p.length > 120);
  if (paragraph) {
    result.jobSummary = { value: paragraph.slice(0, 400), confidence: 55 };
  }

  // Suggested follow-up date: 7 business days out
  result.suggestedFollowUpDate = {
    value: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    confidence: 90,
  };

  // Priority score heuristic: boost if visa-friendly, salary present, remote
  let priority = 50;
  if (result.visaNotes && /sponsor/i.test(result.visaNotes.value)) priority += 15;
  if (result.salaryRange) priority += 10;
  if (result.workMode?.value === "remote") priority += 10;
  result.priorityScore = { value: Math.min(priority, 100), confidence: 50 };

  // Missing skills + resume match score + suggested resume version require a resume
  // to diff against, so they're computed later once the user selects a resume.

  return result;
}

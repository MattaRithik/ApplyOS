import { validateEmployment } from "./employment";
import type { RawAiJobParse, ProvenanceMap } from "@/lib/ai-parser/schema";
import { recruitingEmailEvidence } from "@/lib/ai-parser/deterministic";
import { validateCompensation } from "@/lib/ai-parser/compensation";
import { detectWorkplace } from "@/lib/ai-parser/workplace";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
}

/** Evidence must quote the input; a model's explanation is not supporting evidence. */
function quotedEvidence(raw: RawAiJobParse, path: string, text: string): string | null {
  const note = raw.metadata.evidence?.find((entry) => entry.field === path)?.note;
  return note && note.trim().length >= 8 && normalize(text).includes(normalize(note)) ? note : null;
}

/** Pure post-processing for NEW provider results only; never used to rewrite stored records. */
export function validateExtraction(raw: RawAiJobParse, text: string): { result: RawAiJobParse; provenance: ProvenanceMap } {
  const result = structuredClone(raw);
  const provenance: ProvenanceMap = {};
  Object.assign(provenance, validateEmployment(result, text));
  const warnings = new Set(result.metadata.warnings ?? []);
  const pay = validateCompensation(result.compensation, result.location, text);
  result.compensation = pay.compensation;
  Object.assign(provenance, pay.provenance);
  if (pay.warning) warnings.add(pay.warning);
  if (pay.resolvedMultipleRanges) {
    for (const warning of warnings) {
      if (/salary|pay|compensation/i.test(warning) && /(?:left|set|remain|kept)[^.]*\b(?:null|blank|unknown)\b/i.test(warning)) warnings.delete(warning);
    }
    warnings.add("Multiple pay statements are present. Salary was matched to the stated job location or explicit hourly rate; review the original pay terms.");
  }

  const workplace = detectWorkplace(text);
  if (workplace) {
    result.location.workplaceType = workplace.value;
    provenance["location.workplaceType"] = { status: workplace.value === "unknown" ? "uncertain" : "explicit", evidence: workplace.evidence };
    if (workplace.value === "unknown") warnings.add("The posting contains conflicting work schedules. Confirm the arrangement for this role.");
  } else if (result.location.workplaceType !== "unknown") {
    // Don't turn unsupported AI guesses or general amenities into a form selection.
    result.location.workplaceType = "unknown";
    provenance["location.workplaceType"] = { status: "uncertain" };
  }

  const email = result.identity.recruiterEmail;
  if (email) {
    const evidence = recruitingEmailEvidence(text, email);
    if (evidence) {
      provenance["identity.recruiterEmail"] = { status: "explicit", evidence };
    } else {
      result.identity.recruiterEmail = null;
      result.identity.recruiterName = null;
      provenance["identity.recruiterEmail"] = { status: "missing" };
      provenance["identity.recruiterName"] = { status: "missing" };
      warnings.add("An email address was omitted because it was not identified as a recruiting contact for this role.");
    }
  }

  // Absence of sponsorship language, EEO text, work authorization, OPT/CPT, or
  // citizenship restrictions alone never establish that sponsorship is unavailable.
  const clauses = text.split(/\n|(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const sponsorship = clauses.filter((s) => /\bsponsorship\b|\b(?:visa|immigration|employment|work|H-?1B)\b[^.]*\bsponsor|\bsponsor\w*[^.]*\b(?:visa|immigration|employment|work|H-?1B|candidates|applicants)\b/i.test(s));
  const positive = sponsorship.filter((s) => /(?:sponsorship|sponsor\w*).*(?:available|provided|offered|considered)|(?:we|can|will|may|able to)\s+(?:provide\s+)?sponsor|(?:offer|provide|support|consider)\s+(?:(?:employment|visa|immigration|work|H-?1B)\s+){0,3}sponsorship/i.test(s)
    && !/\b(?:not|no|unable|cannot|can't|won't|without)\b/i.test(s.replace(/(?:but\s+)?(?:is\s+)?not\s+(?:always\s+)?guaranteed/gi, "")));
  const negative = sponsorship.filter((s) => !/not\s+(?:always\s+)?guaranteed|(?:cannot|can't|not)\s+guarantee|not\s+(?:automatic|assured)|no\s+guarantee/i.test(s)
    && (!/not\s+(?:require|need)\b/i.test(s) || /\b(?:must|only|required)\b/i.test(s))
    && /(?:not|never|cannot|can't|won't|unable to)\s+(?:currently\s+|now\s+|be\s+|able to\s+|provide\s+|offer\s+|require\s+|need\s+)*(?:\w+\s+){0,3}sponsor|no\s+(?:\w+\s+){0,3}sponsorship|sponsorship\s+(?:is\s+|will be\s+)?(?:not|unavailable)|without\s+(?:\w+\s+){0,5}sponsorship/i.test(s));
  if (positive.length && !negative.length) {
    // Product choice: limited/conditional sponsorship remains eligible for the H-1B option,
    // with the employer's exact qualification retained in the notes.
    result.immigration.visaSponsorship = "available";
    result.immigration.sponsorshipText = positive.join(" ").slice(0, 500);
    provenance["immigration.visaSponsorship"] = { status: "explicit", evidence: positive[0].slice(0, 300) };
    provenance["immigration.sponsorshipText"] = { status: "explicit", evidence: positive[0].slice(0, 300) };
  } else if (negative.length && !positive.length) {
    result.immigration.visaSponsorship = "not_available";
    result.immigration.sponsorshipText = negative.join(" ").slice(0, 500);
    provenance["immigration.visaSponsorship"] = { status: "explicit", evidence: negative[0].slice(0, 300) };
    provenance["immigration.sponsorshipText"] = { status: "explicit", evidence: negative[0].slice(0, 300) };
  } else if (!sponsorship.length) {
    result.immigration.visaSponsorship = "not_mentioned";
    provenance["immigration.visaSponsorship"] = { status: "missing" };
    // Retain actual authorization restrictions separately without guessing sponsorship policy.
    if (result.immigration.sponsorshipText && !normalize(text).includes(normalize(result.immigration.sponsorshipText))) {
      result.immigration.sponsorshipText = null;
    }
  } else {
    result.immigration.visaSponsorship = "unclear";
    provenance["immigration.visaSponsorship"] = { status: "uncertain", evidence: sponsorship.join(" ").slice(0, 300) };
    result.immigration.sponsorshipText = sponsorship.join(" ").slice(0, 500);
    provenance["immigration.sponsorshipText"] = { status: "explicit", evidence: sponsorship[0].slice(0, 300) };
  }

  const experience = result.experienceEducation;
  for (const field of ["minimumYearsExperience", "maximumYearsExperience"] as const) {
    if (experience[field] === null) continue;
    const evidence = quotedEvidence(result, `experienceEducation.${field}`, text);
    const sourceClauses = evidence ? clauses.filter((clause) => normalize(clause).includes(normalize(evidence))).join(" ") : "";
    const context = `${sourceClauses} ${experience.experienceText ?? evidence ?? ""}`;
    const conditional = /\b(?:ideally|preferred|preferably|desired|nice.to.have|a plus|or|equivalent)\b/i.test(context);
    if (conditional || !evidence || experience[field]! < 0) {
      experience[field] = null;
      provenance[`experienceEducation.${field}`] = { status: "missing" };
    } else {
      provenance[`experienceEducation.${field}`] = { status: "explicit", evidence };
    }
  }
  // Never claim a required completed graduate degree solely because an internship
  // asks for current enrollment. The complete requirement remains readable in text.
  if (experience.graduateDegreeRequired === true && /enrolled|pursuing|currently studying/i.test(experience.educationLevel ?? "")) {
    experience.graduateDegreeRequired = null;
    provenance["experienceEducation.graduateDegreeRequired"] = { status: "missing" };
  }

  result.metadata.warnings = warnings.size ? [...warnings].slice(0, 30) : null;
  return { result, provenance };
}

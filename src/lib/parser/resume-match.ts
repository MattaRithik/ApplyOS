import "server-only";
import { PDFParse } from "pdf-parse";
import * as mammoth from "mammoth";
import { createResumeDownloadUrl } from "@/lib/storage/b2";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ResumeComparison } from "@/lib/parser/schema";
import {
  PROGRAMMING_LANGUAGES,
  TECHNOLOGIES,
  FINANCE_SKILLS,
  ML_AI_SKILLS,
  ALL_SKILLS,
  extractSkillsFromLibrary,
} from "@/lib/parser/skills";

/** Extracts plain text from a resume file buffer. Returns null if the format can't be parsed. */
async function extractTextFromBuffer(buffer: Buffer, extension: string): Promise<string | null> {
  try {
    if (extension === "pdf") {
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        return result.text || null;
      } finally {
        await parser.destroy();
      }
    }
    if (extension === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || null;
    }
    // Legacy binary .doc has no reliable pure-JS extractor — skip gracefully.
    return null;
  } catch {
    return null;
  }
}

interface ResumeRow {
  id: string;
  storage_key: string;
  file_extension: string | null;
  parsed_text: string | null;
}

/**
 * Returns the resume's plain text, extracting and caching it into
 * `resumes.parsed_text` on first use (lazy, read-through cache — the
 * upload flow itself never runs extraction).
 */
export async function getOrExtractResumeText(userId: string, resumeId: string): Promise<string | null> {
  const supabase = createServiceRoleClient();

  const { data: resume } = await supabase
    .from("resumes")
    .select("id, storage_key, file_extension, parsed_text")
    .eq("id", resumeId)
    .eq("user_id", userId)
    .single<ResumeRow>();

  if (!resume) return null;
  if (resume.parsed_text) return resume.parsed_text;
  if (!resume.file_extension || resume.file_extension === "doc") return null;

  try {
    const { url } = await createResumeDownloadUrl(resume.storage_key);
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const text = await extractTextFromBuffer(buffer, resume.file_extension);
    if (text) {
      await supabase.from("resumes").update({ parsed_text: text }).eq("id", resumeId).eq("user_id", userId);
    }
    return text;
  } catch {
    return null;
  }
}

const SKILL_CATEGORIES: { library: string[]; label: "technology" | "finance" | "programming" }[] = [
  { library: PROGRAMMING_LANGUAGES, label: "programming" },
  { library: TECHNOLOGIES, label: "technology" },
  { library: [...FINANCE_SKILLS, ...ML_AI_SKILLS], label: "finance" },
];

/** Deterministic resume-vs-job-description comparison — no AI involved, so results are reproducible. */
export function compareResumeToJob(resumeText: string, jobDescription: string, jobKeywords: string[]): ResumeComparison {
  const resumeSkills = extractSkillsFromLibrary(resumeText, ALL_SKILLS);
  const jobSkills = extractSkillsFromLibrary(jobDescription, ALL_SKILLS);
  const jobSkillSet = new Set(jobSkills.length ? jobSkills : jobKeywords);

  const matchedSkills = [...jobSkillSet].filter((s) => resumeSkills.includes(s));
  const missingSkills = [...jobSkillSet].filter((s) => !resumeSkills.includes(s));

  const missingByCategory = (label: "technology" | "finance" | "programming") => {
    const category = SKILL_CATEGORIES.find((c) => c.label === label)!;
    return missingSkills.filter((s) => category.library.includes(s));
  };

  const overallMatchPercent = jobSkillSet.size === 0 ? 50 : Math.round((matchedSkills.length / jobSkillSet.size) * 100);

  const keywordSet = new Set(jobKeywords);
  const resumeLower = resumeText.toLowerCase();
  const coveredKeywords = [...keywordSet].filter((k) => resumeLower.includes(k.toLowerCase()));
  const keywordCoveragePercent = keywordSet.size === 0 ? 50 : Math.round((coveredKeywords.length / keywordSet.size) * 100);

  const topResumeStrengths = matchedSkills.slice(0, 6);
  const topResumeWeaknesses = missingSkills.slice(0, 6);

  const recommendedImprovements: string[] = [];
  if (missingByCategory("programming").length) {
    recommendedImprovements.push(`Add or highlight experience with ${missingByCategory("programming").slice(0, 3).join(", ")}.`);
  }
  if (missingByCategory("finance").length) {
    recommendedImprovements.push(`Surface any coursework or project experience touching ${missingByCategory("finance").slice(0, 3).join(", ")}.`);
  }
  if (missingByCategory("technology").length) {
    recommendedImprovements.push(`Mention hands-on exposure to ${missingByCategory("technology").slice(0, 3).join(", ")} if you have it.`);
  }
  if (overallMatchPercent < 50) {
    recommendedImprovements.push("Overall keyword overlap is low — consider tailoring a version of your resume specifically for this role.");
  }

  return {
    matchedSkills,
    missingSkills,
    missingTechnologies: missingByCategory("technology"),
    missingFinanceKnowledge: missingByCategory("finance"),
    missingProgrammingLanguages: missingByCategory("programming"),
    overallMatchPercent,
    keywordCoveragePercent,
    topResumeStrengths,
    topResumeWeaknesses,
    recommendedImprovements: recommendedImprovements.slice(0, 10),
  };
}

/**
 * Finance/quant-aware skill taxonomy shared by the heuristic parser, the AI
 * prompt (as a hint list), and resume matching. Kept separate from
 * heuristic.ts so resume-match.ts can reuse it without a circular import.
 */

export const PROGRAMMING_LANGUAGES = [
  "Python", "Java", "JavaScript", "TypeScript", "C++", "C#", "C", "Go", "Rust", "Swift",
  "Kotlin", "Scala", "R", "MATLAB", "VBA", "SQL", "Julia",
];

export const TECHNOLOGIES = [
  "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "CI/CD", "Git", "Linux",
  "Spark", "Hadoop", "Airflow", "Kafka", "REST", "GraphQL", "Microservices",
  "React", "Next.js", "Node.js", "Django", "Flask", "Bloomberg Terminal", "FIX Protocol",
  "Snowflake", "Databricks", "Tableau", "Power BI",
];

export const FINANCE_SKILLS = [
  "Financial Modeling", "Valuation", "DCF", "Risk Management", "Derivatives", "Options",
  "Fixed Income", "Equities", "Portfolio Optimization", "Volatility Modeling", "Time Series",
  "Backtesting", "Algorithmic Trading", "Market Microstructure", "Credit Risk", "Market Risk",
  "VaR", "Monte Carlo Simulation", "Stochastic Calculus", "Statistics", "Probability",
  "Linear Algebra", "Econometrics", "Bloomberg", "Reuters Eikon", "GAAP", "IFRS",
];

export const ML_AI_SKILLS = [
  "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "Pandas", "NumPy",
  "Scikit-learn", "NLP", "Computer Vision", "Reinforcement Learning", "LLMs",
];

export const SOFT_SKILLS = [
  "Communication", "Leadership", "Project Management", "Teamwork", "Problem Solving",
  "Analytical Thinking", "Attention to Detail", "Stakeholder Management", "Presentation",
];

export const ALL_SKILLS = [
  ...PROGRAMMING_LANGUAGES,
  ...TECHNOLOGIES,
  ...FINANCE_SKILLS,
  ...ML_AI_SKILLS,
  ...SOFT_SKILLS,
];

export const SUGGESTED_TAG_LIBRARY = [
  "Python", "SQL", "C++", "AWS", "Docker", "Kubernetes", "Pandas", "NumPy", "Risk",
  "Bloomberg", "Trading", "ETL", "Finance", "Machine Learning", "Statistics", "Probability",
  "Linear Algebra", "Time Series", "Portfolio Optimization", "Derivatives",
];

/** Escapes a skill name for safe use inside a RegExp word-boundary match. */
function toWordRegex(skill: string): RegExp {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Skills containing non-word characters (C++, C#, CI/CD) can't use \b on both sides reliably;
  // fall back to a looser boundary in that case.
  const hasWordBoundaryIssue = /[^a-zA-Z0-9 ]/.test(skill);
  return hasWordBoundaryIssue
    ? new RegExp(`(?:^|\\s)${escaped}(?:$|\\s|[,.;:])`, "i")
    : new RegExp(`\\b${escaped}\\b`, "i");
}

export function extractSkillsFromLibrary(text: string, library: string[]): string[] {
  return library.filter((skill) => toWordRegex(skill).test(text));
}

export const FINANCE_ROLE_CATEGORY_PATTERNS: [RegExp, string][] = [
  [/quant(itative)?\s+research/i, "Quant Research"],
  [/quant(itative)?\s+trad(er|ing)/i, "Quant Trading"],
  [/quant(itative)?\s+develop/i, "Quant Developer"],
  [/credit\s+risk/i, "Credit Risk"],
  [/market\s+risk/i, "Market Risk"],
  [/\brisk\b/i, "Risk"],
  [/investment\s+bank/i, "Investment Banking"],
  [/equity\s+research/i, "Equity Research"],
  [/fixed\s+income/i, "Fixed Income"],
  [/portfolio\s+manage/i, "Portfolio Management"],
  [/data\s+engineer/i, "Data Engineering"],
  [/machine\s+learning/i, "Machine Learning"],
  [/\bartificial intelligence\b|\bAI\b/, "AI"],
  [/trading\s+systems?/i, "Trading Systems"],
  [/financial\s+data/i, "Financial Data"],
  [/asset\s+manage/i, "Asset Management"],
  [/derivatives?/i, "Derivatives"],
  [/\boptions?\b/i, "Options"],
  [/volatility/i, "Volatility"],
  [/crypto/i, "Crypto"],
  [/hedge\s+fund/i, "Hedge Fund"],
  [/private\s+equity/i, "Private Equity"],
  [/consult(ing|ant)/i, "Consulting"],
  [/operations?/i, "Operations"],
  [/software\s+engineer/i, "Software Engineering"],
];

export function classifyFinanceRoleCategory(text: string): string | null {
  const hit = FINANCE_ROLE_CATEGORY_PATTERNS.find(([re]) => re.test(text));
  return hit ? hit[1] : null;
}

export function suggestTags(text: string): string[] {
  return extractSkillsFromLibrary(text, SUGGESTED_TAG_LIBRARY);
}

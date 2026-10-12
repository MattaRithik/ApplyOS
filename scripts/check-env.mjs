import nextEnv from "@next/env";

// Validate names and shapes locally. Never print credential values or call
// external services; this command is also safe to run before deployment.
nextEnv.loadEnvConfig(process.cwd());
const issues = [];
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_OWNER_EMAIL",
  "B2_KEY_ID",
  "B2_APPLICATION_KEY",
  "B2_BUCKET_NAME",
  "B2_REGION",
  "B2_ENDPOINT",
  "OPENAI_API_KEY",
];
for (const key of required) {
  if (!process.env[key]?.trim()) issues.push(`${key} is required.`);
}
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "B2_ENDPOINT"]) {
  try {
    const url = new URL(process.env[key]);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if ((url.protocol !== "https:" && !local) || url.username || url.password)
      issues.push(`${key} must be an HTTPS URL without credentials.`);
  } catch {
    issues.push(`${key} must be a valid URL.`);
  }
}
if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === process.env.SUPABASE_SERVICE_ROLE_KEY) {
  issues.push("Public and service-role Supabase keys must be different.");
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.APP_OWNER_EMAIL ?? ""))
  issues.push("APP_OWNER_EMAIL must be a valid email address.");
for (const key of Object.keys(process.env)) {
  if (key.startsWith("NEXT_PUBLIC_") && /(?:SECRET|SERVICE_ROLE|PRIVATE|OPENAI|B2_)/i.test(key)) {
    issues.push(`${key} must not be exposed as a public variable.`);
  }
}
for (const [key, max] of [
  ["AI_PARSER_DEFAULT_DAILY_LIMIT", 10_000],
  ["AI_PARSER_MINUTE_LIMIT", 100],
  ["AI_PARSER_CONCURRENCY_LIMIT", 10],
  ["AI_PARSER_MAX_INPUT_CHARS", 100_000],
]) {
  const raw = process.env[key];
  if (
    raw !== undefined &&
    (!Number.isInteger(Number(raw)) || Number(raw) <= 0 || Number(raw) > max)
  )
    issues.push(`${key} must be an integer between 1 and ${max}.`);
}
for (const key of ["AI_PARSER_DEFAULT_MONTHLY_BUDGET_USD", "AI_PARSER_GLOBAL_MONTHLY_BUDGET_USD"]) {
  const raw = process.env[key];
  if (raw !== undefined && (!raw.trim() || !Number.isFinite(Number(raw)) || Number(raw) < 0))
    issues.push(`${key} must be a nonnegative amount.`);
}
if (
  !/^gpt-5-(?:mini|nano)(?:-\d{4}-\d{2}-\d{2})?$/.test(process.env.AI_PARSER_MODEL ?? "gpt-5-mini")
) {
  issues.push("AI_PARSER_MODEL needs a supported pricing entry before public use.");
}
if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    "Required configuration is present and valid. Hosted settings still require separate verification.",
  );
}

import { parseJobDescriptionHeuristic } from "./heuristic";
import { jobExtractionSchema, jobIntelligenceSchema } from "./schema";
import { classifyVisaStatus } from "./visa";

const jd = `Quantitative Researcher — Jane Street

Jane Street is looking for a Quantitative Researcher to join our trading team in New York, NY. This is a full-time, onsite role.

Responsibilities:
- Build and backtest statistical trading models
- Analyze large financial datasets using Python and SQL
- Collaborate with traders on strategy development

Requirements:
- 3+ years of experience in quantitative research
- Strong skills in Python, C++, and Statistics
- Experience with Machine Learning and Time Series analysis
- Bachelor's degree in a quantitative field

Preferred:
- Experience with Derivatives and Options pricing
- Familiarity with AWS and Docker

We are able to sponsor H1B visas for qualified candidates. Salary range: $150,000 - $220,000. Please apply by March 30, 2026.

Contact: recruiting@janestreet.com`;

const { extraction, intelligence, tags, financeCategory } = parseJobDescriptionHeuristic(jd, "https://jane-street.greenhouse.io/jobs/123");

console.log("--- extraction ---");
console.log(JSON.stringify(extraction, null, 2));
console.log("--- intelligence ---");
console.log(JSON.stringify(intelligence, null, 2));
console.log("--- tags ---", tags);
console.log("--- financeCategory ---", financeCategory);

const extractionCheck = jobExtractionSchema.safeParse(extraction);
const intelligenceCheck = jobIntelligenceSchema.safeParse(intelligence);
console.log("--- extraction valid? ---", extractionCheck.success, extractionCheck.success ? "" : extractionCheck.error.message);
console.log("--- intelligence valid? ---", intelligenceCheck.success, intelligenceCheck.success ? "" : intelligenceCheck.error.message);

console.log("--- visa classification ---", classifyVisaStatus(jd));
console.log("--- visa classification (no mention) ---", classifyVisaStatus("We are a fast-growing startup building great products."));
console.log("--- visa classification (explicit no sponsor) ---", classifyVisaStatus("We are unable to sponsor visas at this time."));

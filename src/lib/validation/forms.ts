import { z } from "zod";
import {
  APPLICATION_STATUSES,
  VISA_SPONSORSHIP_STATUSES,
  RELATIONSHIP_TYPES,
  RESPONSE_STATUSES,
  OUTREACH_TYPES,
  TEMPLATE_CATEGORIES,
  INTERVIEW_ROUND_TYPES,
  INTERVIEW_RESULTS,
} from "@/lib/types/database";
import {
  optionalHttpUrlSchema,
  optionalIsoDateSchema,
  optionalTextSchema,
  optionalUuidSchema,
  shortTextSchema,
  isoDateSchema,
} from "./common";

const email = z
  .string()
  .trim()
  .max(254)
  .email()
  .or(z.literal("").transform(() => null))
  .nullable()
  .optional();
const score = z.number().finite().min(0).max(100);
const salary = z.number().finite().min(0).max(1_000_000_000).nullable().optional();
const tags = z.array(z.string().trim().min(1).max(200)).max(100).optional();

export const applicationInputSchema = z
  .object({
    company_name: shortTextSchema,
    job_title: shortTextSchema,
    job_url: optionalHttpUrlSchema,
    job_description: optionalTextSchema(100_000),
    location: optionalTextSchema(500),
    work_mode: z.enum(["remote", "hybrid", "onsite"]).nullable().optional(),
    employment_type: z
      .enum(["full_time", "part_time", "internship", "contract", "temporary"])
      .nullable()
      .optional(),
    salary_min: salary,
    salary_max: salary,
    salary_currency: optionalTextSchema(10),
    visa_sponsorship_notes: optionalTextSchema(5_000),
    visa_sponsorship_status: z.enum(VISA_SPONSORSHIP_STATUSES.map((item) => item.value)).optional(),
    date_applied: optionalIsoDateSchema,
    status: z.enum(APPLICATION_STATUSES.map((item) => item.value)).optional(),
    priority_score: score.optional(),
    resume_id: optionalUuidSchema,
    cover_letter_used: optionalTextSchema(20_000),
    referral_person: optionalTextSchema(200),
    referral_email: email,
    referral_phone: optionalTextSchema(100),
    recruiter_name: optionalTextSchema(200),
    hr_email: email,
    recruiter_linkedin_url: optionalHttpUrlSchema,
    hiring_manager_linkedin_url: optionalHttpUrlSchema,
    notes: optionalTextSchema(20_000),
    follow_up_date: optionalIsoDateSchema,
    source: optionalTextSchema(500),
    keywords: tags,
    required_skills: tags,
    preferred_skills: tags,
    resume_match_score: score.nullable().optional(),
  })
  .strict();

export const companyInputSchema = z
  .object({
    name: shortTextSchema,
    website: optionalHttpUrlSchema,
    careers_page_url: optionalHttpUrlSchema,
    industry: optionalTextSchema(500),
    location: optionalTextSchema(500),
    linkedin_url: optionalHttpUrlSchema,
    sponsorship_friendly: z.boolean().nullable().optional(),
    sponsorship_notes: optionalTextSchema(5_000),
    notes: optionalTextSchema(20_000),
  })
  .strict();

export const contactInputSchema = z
  .object({
    name: shortTextSchema,
    company_id: optionalUuidSchema,
    company_name: optionalTextSchema(200),
    role_title: optionalTextSchema(200),
    email,
    linkedin_url: optionalHttpUrlSchema,
    phone: optionalTextSchema(100),
    relationship_type: z.enum(RELATIONSHIP_TYPES.map((item) => item.value)),
    source: optionalTextSchema(500),
    last_contacted_date: optionalIsoDateSchema,
    next_follow_up_date: optionalIsoDateSchema,
    response_status: z.enum(RESPONSE_STATUSES.map((item) => item.value)).optional(),
    notes: optionalTextSchema(20_000),
  })
  .strict();

export const outreachInputSchema = z
  .object({
    contact_id: optionalUuidSchema,
    company_id: optionalUuidSchema,
    application_id: optionalUuidSchema,
    template_id: optionalUuidSchema,
    person_name: optionalTextSchema(200),
    company_name: optionalTextSchema(200),
    email,
    linkedin_url: optionalHttpUrlSchema,
    outreach_type: z.enum(OUTREACH_TYPES.map((item) => item.value)),
    subject_line: optionalTextSchema(500),
    message_sent: optionalTextSchema(20_000),
    date_sent: isoDateSchema,
    follow_up_date: optionalIsoDateSchema,
    response_received: z.boolean().optional(),
    response_type: z
      .enum(RESPONSE_STATUSES.map((item) => item.value))
      .nullable()
      .optional(),
    response_date: optionalIsoDateSchema,
    notes: optionalTextSchema(20_000),
  })
  .strict();

export const templateInputSchema = z
  .object({
    name: shortTextSchema,
    category: z.enum(TEMPLATE_CATEGORIES.map((item) => item.value)),
    subject: optionalTextSchema(500),
    body: z.string().max(20_000),
  })
  .strict();

export const interviewInputSchema = z
  .object({
    round_name: shortTextSchema,
    round_type: z.enum(INTERVIEW_ROUND_TYPES.map((item) => item.value)),
    scheduled_at: z.iso.datetime({ offset: true }).nullable().optional(),
    interviewer_name: optionalTextSchema(200),
    interviewer_linkedin_url: optionalHttpUrlSchema,
    interviewer_email: email,
    meeting_link: optionalHttpUrlSchema,
    preparation_notes: optionalTextSchema(20_000),
    questions_asked: optionalTextSchema(20_000),
    result: z.enum(INTERVIEW_RESULTS.map((item) => item.value)).optional(),
    follow_up_sent: z.boolean().optional(),
    thank_you_email_sent: z.boolean().optional(),
  })
  .strict();

export const profileInputSchema = z
  .object({
    full_name: optionalTextSchema(200),
    target_role: optionalTextSchema(1_000),
    job_search_start_date: optionalIsoDateSchema,
  })
  .strict();

export function parseActionInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new Error("Invalid input. Check the field types, dates, and length limits.");
  return result.data;
}

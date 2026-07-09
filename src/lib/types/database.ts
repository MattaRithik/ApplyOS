// Hand-authored types mirroring supabase/schema.sql.
// Regenerate/replace with `supabase gen types typescript` against a live
// project if you want generated types instead.

export type ApplicationStatus =
  | "saved"
  | "planning_to_apply"
  | "applied"
  | "referral_requested"
  | "hr_contacted"
  | "recruiter_screen"
  | "oa_assessment"
  | "first_round"
  | "technical_round"
  | "superday_final_round"
  | "offer"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "ghosted";

export type WorkMode = "remote" | "hybrid" | "onsite";
export type EmploymentType = "full_time" | "part_time" | "internship" | "contract" | "temporary";
export type RelationshipType =
  | "recruiter"
  | "hiring_manager"
  | "hr"
  | "alumni"
  | "referral"
  | "employee"
  | "professor"
  | "career_fair"
  | "other";
export type OutreachType =
  | "cold_email"
  | "linkedin_dm"
  | "referral_request"
  | "follow_up"
  | "thank_you"
  | "application_status_check"
  | "other";
export type ResponseStatus =
  | "no_response"
  | "opened"
  | "replied_positive"
  | "replied_negative"
  | "referred"
  | "meeting_scheduled"
  | "declined";
export type InterviewRoundType =
  | "phone_screen"
  | "recruiter_screen"
  | "oa_assessment"
  | "first_round"
  | "technical"
  | "behavioral"
  | "system_design"
  | "case_study"
  | "superday"
  | "final_round"
  | "other";
export type InterviewResult = "pending" | "passed" | "failed" | "cancelled" | "no_show";
export type TemplateCategory =
  | "recruiter_cold_email"
  | "hiring_manager_cold_email"
  | "alumni_referral_request"
  | "linkedin_dm"
  | "follow_up_no_response"
  | "thank_you_after_interview"
  | "interview_follow_up"
  | "career_fair_follow_up"
  | "referral_thank_you"
  | "application_status_check"
  | "custom";
export type FollowUpContext = "application" | "cold_email" | "interview" | "referral" | "general";
export type ExportFormat = "xlsx" | "csv";
export type ExportEntity =
  | "applications"
  | "companies"
  | "contacts"
  | "outreach"
  | "interviews"
  | "follow_ups"
  | "resumes"
  | "full_backup";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  target_role: string | null;
  job_search_start_date: string | null;
  theme_preference: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  user_id: string;
  name: string;
  website: string | null;
  careers_page_url: string | null;
  industry: string | null;
  location: string | null;
  linkedin_url: string | null;
  sponsorship_friendly: boolean | null;
  sponsorship_notes: string | null;
  notes: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export type ResumeStatus = "uploading" | "uploaded" | "failed";

export interface Resume {
  id: string;
  user_id: string;
  display_name: string;
  original_file_name: string;
  storage_provider: string;
  storage_key: string;
  file_extension: "pdf" | "doc" | "docx" | null;
  file_type: string | null;
  file_size: number | null;
  status: ResumeStatus;
  uploaded_at: string | null;
  target_role: string | null;
  version_notes: string | null;
  resume_match_score: number | null;
  missing_keywords: string[];
  parsed_text: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  user_id: string;
  company_id: string | null;
  company_name: string;
  job_title: string;
  job_url: string | null;
  job_description: string | null;
  location: string | null;
  work_mode: WorkMode | null;
  employment_type: EmploymentType | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  visa_sponsorship_notes: string | null;
  date_applied: string | null;
  status: ApplicationStatus;
  priority_score: number;
  resume_id: string | null;
  cover_letter_used: string | null;
  referral_person: string | null;
  recruiter_name: string | null;
  hr_email: string | null;
  recruiter_linkedin_url: string | null;
  hiring_manager_linkedin_url: string | null;
  notes: string | null;
  follow_up_date: string | null;
  final_result: string | null;
  source: string | null;
  keywords: string[];
  required_skills: string[];
  preferred_skills: string[];
  resume_match_score: number | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApplicationStatusHistory {
  id: string;
  user_id: string;
  application_id: string;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  changed_at: string;
  notes: string | null;
}

export interface ParsedJobDetails {
  id: string;
  user_id: string;
  application_id: string | null;
  source_url: string | null;
  raw_job_description: string | null;
  parsed_company: string | null;
  parsed_job_title: string | null;
  parsed_role_type: string | null;
  parsed_location: string | null;
  parsed_work_mode: WorkMode | null;
  parsed_employment_type: EmploymentType | null;
  parsed_salary_range: string | null;
  required_skills: string[];
  preferred_skills: string[];
  education: string | null;
  years_experience: string | null;
  visa_notes: string | null;
  deadline: string | null;
  recruiter_info: string | null;
  keywords: string[];
  job_summary: string | null;
  resume_match_score: number | null;
  missing_skills: string[];
  suggested_resume_id: string | null;
  suggested_cold_email_angle: string | null;
  suggested_follow_up_date: string | null;
  priority_score: number | null;
  field_confidence: Record<string, number>;
  created_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  company_id: string | null;
  name: string;
  company_name: string | null;
  role_title: string | null;
  email: string | null;
  linkedin_url: string | null;
  phone: string | null;
  relationship_type: RelationshipType;
  source: string | null;
  last_contacted_date: string | null;
  next_follow_up_date: string | null;
  response_status: ResponseStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplate {
  id: string;
  user_id: string;
  name: string;
  category: TemplateCategory;
  subject: string | null;
  body: string;
  is_system_default: boolean;
  times_used: number;
  reply_count: number;
  created_at: string;
  updated_at: string;
}

export interface Outreach {
  id: string;
  user_id: string;
  contact_id: string | null;
  company_id: string | null;
  application_id: string | null;
  template_id: string | null;
  person_name: string | null;
  company_name: string | null;
  email: string | null;
  linkedin_url: string | null;
  outreach_type: OutreachType;
  subject_line: string | null;
  message_sent: string | null;
  date_sent: string;
  follow_up_date: string | null;
  response_received: boolean;
  response_type: ResponseStatus | null;
  response_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InterviewRound {
  id: string;
  user_id: string;
  application_id: string;
  round_name: string;
  round_type: InterviewRoundType;
  scheduled_at: string | null;
  interviewer_name: string | null;
  interviewer_linkedin_url: string | null;
  interviewer_email: string | null;
  meeting_link: string | null;
  preparation_notes: string | null;
  questions_asked: string | null;
  result: InterviewResult;
  follow_up_sent: boolean;
  thank_you_email_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface FollowUp {
  id: string;
  user_id: string;
  context: FollowUpContext;
  application_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  outreach_id: string | null;
  interview_round_id: string | null;
  title: string;
  due_date: string;
  is_completed: boolean;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  entity_type: "application" | "company" | "contact" | "outreach" | "interview_round" | "resume";
  entity_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface ExportRecord {
  id: string;
  user_id: string;
  entity: ExportEntity;
  format: ExportFormat;
  filters: Record<string, unknown>;
  row_count: number | null;
  file_path: string | null;
  created_at: string;
}

export const APPLICATION_STATUSES: { value: ApplicationStatus; label: string }[] = [
  { value: "saved", label: "Saved" },
  { value: "planning_to_apply", label: "Planning to Apply" },
  { value: "applied", label: "Applied" },
  { value: "referral_requested", label: "Referral Requested" },
  { value: "hr_contacted", label: "HR Contacted" },
  { value: "recruiter_screen", label: "Recruiter Screen" },
  { value: "oa_assessment", label: "OA / Assessment" },
  { value: "first_round", label: "First Round" },
  { value: "technical_round", label: "Technical Round" },
  { value: "superday_final_round", label: "Superday / Final Round" },
  { value: "offer", label: "Offer" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "ghosted", label: "Ghosted" },
];

export const RELATIONSHIP_TYPES: { value: RelationshipType; label: string }[] = [
  { value: "recruiter", label: "Recruiter" },
  { value: "hiring_manager", label: "Hiring Manager" },
  { value: "hr", label: "HR" },
  { value: "alumni", label: "Alumni" },
  { value: "referral", label: "Referral" },
  { value: "employee", label: "Employee" },
  { value: "professor", label: "Professor" },
  { value: "career_fair", label: "Career Fair Contact" },
  { value: "other", label: "Other" },
];

export const OUTREACH_TYPES: { value: OutreachType; label: string }[] = [
  { value: "cold_email", label: "Cold Email" },
  { value: "linkedin_dm", label: "LinkedIn DM" },
  { value: "referral_request", label: "Referral Request" },
  { value: "follow_up", label: "Follow-up" },
  { value: "thank_you", label: "Thank You" },
  { value: "application_status_check", label: "Application Status Check" },
  { value: "other", label: "Other" },
];

export const INTERVIEW_ROUND_TYPES: { value: InterviewRoundType; label: string }[] = [
  { value: "phone_screen", label: "Phone Screen" },
  { value: "recruiter_screen", label: "Recruiter Screen" },
  { value: "oa_assessment", label: "OA / Assessment" },
  { value: "first_round", label: "First Round" },
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
  { value: "system_design", label: "System Design" },
  { value: "case_study", label: "Case Study" },
  { value: "superday", label: "Superday" },
  { value: "final_round", label: "Final Round" },
  { value: "other", label: "Other" },
];

export const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: "recruiter_cold_email", label: "Recruiter Cold Email" },
  { value: "hiring_manager_cold_email", label: "Hiring Manager Cold Email" },
  { value: "alumni_referral_request", label: "Alumni Referral Request" },
  { value: "linkedin_dm", label: "LinkedIn DM" },
  { value: "follow_up_no_response", label: "Follow-up After No Response" },
  { value: "thank_you_after_interview", label: "Thank-You After Interview" },
  { value: "interview_follow_up", label: "Interview Follow-up" },
  { value: "career_fair_follow_up", label: "Career Fair Follow-up" },
  { value: "referral_thank_you", label: "Referral Thank-You" },
  { value: "application_status_check", label: "Application Status Check" },
  { value: "custom", label: "Custom" },
];

-- Adds stages without modifying existing applications or interviews.
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'ai_interview' AFTER 'oa_assessment';
ALTER TYPE public.interview_round_type ADD VALUE IF NOT EXISTS 'ai_interview' AFTER 'oa_assessment';

/**
 * Every hardcoded immigration-timing number in the app must live here, not
 * in a component. Each rule carries where it came from and when someone
 * last checked it against official guidance, so a future review can find
 * every date-math constant in one place instead of grepping components.
 *
 * These are general planning windows, not legal advice and not a
 * guarantee of personal eligibility — see IMMIGRATION_PLANNING_DISCLAIMER.
 */

export interface ImmigrationRule {
  id: string;
  value: number;
  unit: "days";
  description: string;
  sourceUrl: string;
  sourceAuthority: string;
  /** ISO date the value was last checked against the source. */
  lastReviewedDate: string;
}

export const IMMIGRATION_RULES = {
  POST_COMPLETION_OPT_EARLIEST_DAYS_BEFORE_PROGRAM_END: {
    id: "post_completion_opt_earliest_days_before_program_end",
    value: 90,
    unit: "days",
    description:
      "Eligible F-1 students may generally file a post-completion OPT application (Form I-765) up to this many calendar days before their I-20 program end date.",
    sourceUrl:
      "https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/optional-practical-training-opt-for-f-1-students",
    sourceAuthority: "USCIS",
    lastReviewedDate: "2025-01-01",
  },
  POST_COMPLETION_OPT_GENERAL_LATEST_DAYS_AFTER_PROGRAM_END: {
    id: "post_completion_opt_general_latest_days_after_program_end",
    value: 60,
    unit: "days",
    description:
      "Post-completion OPT applications are generally due within this many calendar days after the I-20 program end date, subject to the student's DSO recommendation and current USCIS filing requirements.",
    sourceUrl:
      "https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/optional-practical-training-opt-for-f-1-students",
    sourceAuthority: "USCIS",
    lastReviewedDate: "2025-01-01",
  },
  STEM_OPT_EXTENSION_EARLIEST_DAYS_BEFORE_OPT_END: {
    id: "stem_opt_extension_earliest_days_before_opt_end",
    value: 90,
    unit: "days",
    description:
      "STEM OPT extension applications may generally be filed up to this many calendar days before the student's current post-completion OPT (EAD) expires.",
    sourceUrl: "https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/stem-opt",
    sourceAuthority: "USCIS",
    lastReviewedDate: "2025-01-01",
  },
} as const satisfies Record<string, ImmigrationRule>;

export const SEVP_PORTAL_URL = "https://www.ice.gov/sevis/practical-training";
export const FORM_I765_URL = "https://www.uscis.gov/i-765";

export const IMMIGRATION_PLANNING_DISCLAIMER =
  "ApplyOS provides organizational reminders based on the dates you enter. Immigration rules and personal eligibility can vary. Confirm all filing windows and requirements with your DSO, USCIS, or a qualified immigration professional.";

export function getOptEarliestFilingSupportingText(): string {
  const { value } = IMMIGRATION_RULES.POST_COMPLETION_OPT_EARLIEST_DAYS_BEFORE_PROGRAM_END;
  return `Eligible F-1 students may generally file for post-completion OPT up to ${value} days before the I-20 program end date. Confirm eligibility and timing with your DSO and current USCIS guidance.`;
}

export function getOptGeneralLatestFilingSupportingText(): string {
  const { value } = IMMIGRATION_RULES.POST_COMPLETION_OPT_GENERAL_LATEST_DAYS_AFTER_PROGRAM_END;
  return `Post-completion OPT applications are generally due within ${value} days after the I-20 program end date. Filing also depends on your DSO's recommendation and current USCIS filing requirements — this is a planning estimate, not a guaranteed personal deadline.`;
}

export function getStemOptPreparationSupportingText(): string {
  const { value } = IMMIGRATION_RULES.STEM_OPT_EXTENSION_EARLIEST_DAYS_BEFORE_OPT_END;
  return `STEM OPT extension applications may generally be filed up to ${value} days before your current OPT authorization expires. Confirm eligibility and timing with your DSO and current USCIS guidance.`;
}

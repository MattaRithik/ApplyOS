import { addDays, subDays } from "date-fns";
import { IMMIGRATION_RULES, getOptEarliestFilingSupportingText, getOptGeneralLatestFilingSupportingText, getStemOptPreparationSupportingText } from "@/lib/config/immigration-rules";
import { parseDateOnly, resolveRollingTargetDate } from "@/lib/utils/timeline-date";
import type { InternationalStudentProfile, RollingRule, TimelineCategory, TimelineType, UserTimeline } from "@/lib/types/database";

export interface ResolvedTimeline {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  category: TimelineCategory;
  timelineType: TimelineType;
  /**
   * Null when the timeline references a source date the user hasn't
   * entered yet, OR when `rollingRule` is set — rolling windows depend on
   * "today," which server components can only know in the server's own
   * timezone, so resolving them is deferred to the client (see
   * TimelineCard) where the browser's actual local date is available.
   */
  targetDate: Date | null;
  rollingRule: RollingRule | null;
  sourceLabel: string;
  supportingText: string | null;
  warningText: string | null;
  isMissingData: boolean;
  dashboardSlot: 1 | 2 | 3 | null;
  /** ISO timestamp the underlying row was created — used as the progress bar's start anchor. */
  createdAt: string;
}

/**
 * System (non-custom) timeline types this app knows how to compute, plus
 * enough metadata to render a picker and to tell whether a given user
 * currently has the source date the calculation needs. This is the single
 * place new system timeline types get registered — UI pickers and the
 * resolver both read from it instead of duplicating the list.
 */
export interface SystemTimelineDefinition {
  type: Exclude<TimelineType, "fixed_date" | "custom">;
  label: string;
  category: TimelineCategory;
  isRolling: boolean;
  /** True if this type only makes sense for an F-1 / international-student profile. */
  requiresInternationalProfile: boolean;
  hasSourceData: (profile: InternationalStudentProfile | null) => boolean;
}

export const SYSTEM_TIMELINE_DEFINITIONS: SystemTimelineDefinition[] = [
  {
    type: "i20_program_end",
    label: "Expected Graduation",
    category: "academic",
    isRolling: false,
    requiresInternationalProfile: true,
    hasSourceData: (p) => !!p?.expected_graduation_date,
  },
  {
    type: "end_of_month",
    label: "End of This Month",
    category: "personal",
    isRolling: true,
    requiresInternationalProfile: false,
    hasSourceData: () => true,
  },
  {
    type: "end_of_quarter",
    label: "End of This Quarter",
    category: "personal",
    isRolling: true,
    requiresInternationalProfile: false,
    hasSourceData: () => true,
  },
  {
    type: "end_of_year",
    label: "End of This Year",
    category: "personal",
    isRolling: true,
    requiresInternationalProfile: false,
    hasSourceData: () => true,
  },
];

function getDefinition(type: TimelineType) {
  return SYSTEM_TIMELINE_DEFINITIONS.find((d) => d.type === type) ?? null;
}

/**
 * Turns a stored `user_timelines` row into a concrete date + display copy,
 * computed fresh every call from the authoritative source (the
 * international-student profile, or "today" for rolling windows) — never
 * from a cached column. See the `target_date` comment in the migration for
 * why system-generated rows leave that column null.
 */
export function resolveTimeline(
  timeline: UserTimeline,
  internationalProfile: InternationalStudentProfile | null,
  today: Date = new Date()
): ResolvedTimeline {
  const base = {
    id: timeline.id,
    title: timeline.title,
    description: timeline.description,
    icon: timeline.icon,
    category: timeline.category,
    timelineType: timeline.timeline_type,
    dashboardSlot: timeline.dashboard_slot,
    createdAt: timeline.created_at,
    rollingRule: null as RollingRule | null,
  };

  switch (timeline.timeline_type) {
    case "fixed_date":
    case "custom": {
      return {
        ...base,
        targetDate: timeline.target_date ? parseDateOnly(timeline.target_date) : null,
        sourceLabel: "Custom",
        supportingText: null,
        warningText: null,
        isMissingData: !timeline.target_date,
      };
    }

    case "i20_program_end": {
      const has = !!internationalProfile?.expected_graduation_date;
      return {
        ...base,
        title: "Expected Graduation",
        category: "academic",
        targetDate: has ? parseDateOnly(internationalProfile!.expected_graduation_date!) : null,
        sourceLabel: "From your profile",
        supportingText: null,
        warningText: null,
        isMissingData: !has,
      };
    }

    case "opt_earliest_filing": {
      const has = !!internationalProfile?.i20_program_end_date;
      const targetDate = has
        ? subDays(
            parseDateOnly(internationalProfile!.i20_program_end_date!),
            IMMIGRATION_RULES.POST_COMPLETION_OPT_EARLIEST_DAYS_BEFORE_PROGRAM_END.value
          )
        : null;
      return {
        ...base,
        targetDate,
        sourceLabel: "Calculated · from your I-20 profile",
        supportingText: getOptEarliestFilingSupportingText(),
        warningText: null,
        isMissingData: !has,
      };
    }

    case "opt_general_latest_filing": {
      const has = !!internationalProfile?.i20_program_end_date;
      const targetDate = has
        ? addDays(
            parseDateOnly(internationalProfile!.i20_program_end_date!),
            IMMIGRATION_RULES.POST_COMPLETION_OPT_GENERAL_LATEST_DAYS_AFTER_PROGRAM_END.value
          )
        : null;
      return {
        ...base,
        targetDate,
        sourceLabel: "Calculated · from your I-20 profile",
        supportingText: getOptGeneralLatestFilingSupportingText(),
        warningText:
          "This calculated date depends on your DSO's recommendation and current USCIS filing requirements — it is not a guaranteed personal deadline.",
        isMissingData: !has,
      };
    }

    case "opt_start": {
      const has = !!internationalProfile?.opt_start_date;
      return {
        ...base,
        targetDate: has ? parseDateOnly(internationalProfile!.opt_start_date!) : null,
        sourceLabel: "From your OPT dates",
        supportingText: null,
        warningText: null,
        isMissingData: !has,
      };
    }

    case "opt_end": {
      const has = !!internationalProfile?.opt_end_date;
      return {
        ...base,
        targetDate: has ? parseDateOnly(internationalProfile!.opt_end_date!) : null,
        sourceLabel: "From your OPT dates",
        supportingText: null,
        warningText: null,
        isMissingData: !has,
      };
    }

    case "ead_expiration": {
      const has = !!internationalProfile?.ead_expiration_date;
      return {
        ...base,
        targetDate: has ? parseDateOnly(internationalProfile!.ead_expiration_date!) : null,
        sourceLabel: "From your EAD date",
        supportingText: null,
        warningText: null,
        isMissingData: !has,
      };
    }

    case "stem_opt_preparation": {
      const sourceDate = internationalProfile?.opt_end_date ?? internationalProfile?.ead_expiration_date ?? null;
      const has = !!sourceDate;
      const targetDate = has
        ? subDays(parseDateOnly(sourceDate!), IMMIGRATION_RULES.STEM_OPT_EXTENSION_EARLIEST_DAYS_BEFORE_OPT_END.value)
        : null;
      return {
        ...base,
        targetDate,
        sourceLabel: "Calculated · from your OPT dates",
        supportingText: getStemOptPreparationSupportingText(),
        warningText: null,
        isMissingData: !has,
      };
    }

    case "end_of_month":
    case "end_of_quarter":
    case "end_of_year": {
      return {
        ...base,
        // Resolved with the caller's `today` for convenience (e.g. tests),
        // but callers rendering to a browser should prefer `rollingRule` +
        // the client's own local date — see the ResolvedTimeline comment.
        targetDate: resolveRollingTargetDate(timeline.timeline_type, today),
        rollingRule: timeline.timeline_type,
        sourceLabel: "Rolling · recalculates automatically",
        supportingText: null,
        warningText: null,
        isMissingData: false,
      };
    }

    default: {
      const exhaustive: never = timeline.timeline_type;
      throw new Error(`Unhandled timeline_type: ${exhaustive}`);
    }
  }
}

export function isSystemTimelineAvailable(
  type: SystemTimelineDefinition["type"],
  internationalProfile: InternationalStudentProfile | null
): boolean {
  const def = getDefinition(type);
  if (!def) return false;
  if (def.requiresInternationalProfile && !internationalProfile) return false;
  return def.hasSourceData(internationalProfile);
}

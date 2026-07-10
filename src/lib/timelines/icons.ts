import {
  GraduationCap,
  Globe2,
  Briefcase,
  Users,
  Star,
  CalendarClock,
  PartyPopper,
  Home,
  BookOpen,
  Plane,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { TimelineCategory } from "@/lib/types/database";

export const TIMELINE_ICON_OPTIONS = {
  graduationCap: GraduationCap,
  globe: Globe2,
  briefcase: Briefcase,
  users: Users,
  star: Star,
  calendarClock: CalendarClock,
  partyPopper: PartyPopper,
  home: Home,
  bookOpen: BookOpen,
  plane: Plane,
  target: Target,
} satisfies Record<string, LucideIcon>;

export type TimelineIconKey = keyof typeof TIMELINE_ICON_OPTIONS;

export const CATEGORY_DEFAULT_ICON: Record<TimelineCategory, TimelineIconKey> = {
  academic: "graduationCap",
  immigration: "globe",
  job_search: "briefcase",
  interview: "users",
  personal: "star",
  other: "calendarClock",
};

/**
 * Resolves a saved icon key to its component, falling back to a sensible
 * default for the timeline's category. Not for use directly as a JSX tag
 * inside a component body — call sites should index TIMELINE_ICON_OPTIONS
 * directly there (see TimelineCard) so the icon reference reads as static
 * to React's "no components created during render" check; this helper is
 * for non-render contexts.
 */
export function getTimelineIcon(iconKey: string | null | undefined, category: TimelineCategory): LucideIcon {
  if (iconKey && iconKey in TIMELINE_ICON_OPTIONS) {
    return TIMELINE_ICON_OPTIONS[iconKey as TimelineIconKey];
  }
  return TIMELINE_ICON_OPTIONS[CATEGORY_DEFAULT_ICON[category]];
}

export const TIMELINE_CATEGORY_OPTIONS: { value: TimelineCategory; label: string }[] = [
  { value: "academic", label: "Academic" },
  { value: "immigration", label: "Immigration" },
  { value: "job_search", label: "Job Search" },
  { value: "interview", label: "Interview" },
  { value: "personal", label: "Personal" },
  { value: "other", label: "Other" },
];

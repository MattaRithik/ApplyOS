import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Briefcase,
  Building2,
  Users,
  Send,
  Mail,
  FileText,
  CalendarClock,
  ListChecks,
  BarChart3,
  Download,
  Settings,
  MessageCircle,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: "followUpsDue" | "interviewsUpcoming" | "jobDropsUnread";
  /** Keeps the item permanently highlighted (icon/text tint + glow), not just when its badge has a count. */
  accent?: boolean;
  /** ISO timestamp — shows a pulsing "New" tag until this date, then stops on its own. */
  newUntil?: string;
}

export const primaryNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "Job Drops",
    href: "/job-drops",
    icon: MessageCircle,
    badgeKey: "jobDropsUnread",
    accent: true,
    newUntil: "2026-08-19T23:59:59Z",
  },
  { label: "Applications", href: "/applications", icon: Briefcase },
  { label: "Companies", href: "/companies", icon: Building2 },
  { label: "Contacts", href: "/contacts", icon: Users },
  { label: "Cold Outreach", href: "/outreach", icon: Send },
  { label: "Email Templates", href: "/templates", icon: Mail },
  { label: "Resumes", href: "/resumes", icon: FileText },
  { label: "Interviews", href: "/interviews", icon: CalendarClock },
  { label: "Follow-up Center", href: "/follow-ups", icon: ListChecks, badgeKey: "followUpsDue" },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Export Center", href: "/export", icon: Download },
];

export const secondaryNav: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
];

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
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: "followUpsDue" | "interviewsUpcoming";
}

export const primaryNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
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

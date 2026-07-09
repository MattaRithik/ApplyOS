import type { SupabaseClient } from "@supabase/supabase-js";
import { differenceInCalendarDays, format, startOfMonth, subMonths } from "date-fns";
import type { ApplicationStatus } from "@/lib/types/database";

const INTERVIEW_STATUSES: ApplicationStatus[] = [
  "recruiter_screen",
  "oa_assessment",
  "first_round",
  "technical_round",
  "superday_final_round",
  "offer",
  "accepted",
];
const TERMINAL_STATUSES: ApplicationStatus[] = ["accepted", "rejected", "withdrawn", "ghosted", "offer"];
const PROGRESSED_STATUSES: ApplicationStatus[] = [
  "hr_contacted",
  "recruiter_screen",
  "oa_assessment",
  "first_round",
  "technical_round",
  "superday_final_round",
  "offer",
  "accepted",
  "rejected",
];

const ROLE_CATEGORY_MAP: [RegExp, string][] = [
  [/data scien/i, "Data Science"],
  [/machine learning|\bML\b/i, "Machine Learning"],
  [/frontend|front-end/i, "Frontend Engineering"],
  [/backend|back-end/i, "Backend Engineering"],
  [/full[-\s]?stack/i, "Full-Stack Engineering"],
  [/product manager/i, "Product Management"],
  [/design/i, "Design"],
  [/sales/i, "Sales"],
  [/marketing/i, "Marketing"],
  [/finance|investment|analyst/i, "Finance"],
  [/software engineer|swe/i, "Software Engineering"],
  [/intern/i, "Internship"],
];

function categorize(jobTitle: string): string {
  const hit = ROLE_CATEGORY_MAP.find(([re]) => re.test(jobTitle));
  return hit ? hit[1] : "Other";
}

export interface AnalyticsData {
  applicationVolumeOverTime: { month: string; count: number }[];
  responseRate: number;
  interviewConversionRate: number;
  offerConversionRate: number;
  rejectionRate: number;
  ghostingRate: number;
  bestJobBoards: { source: string; count: number; interviewRate: number }[];
  bestResumeVersions: { name: string; applications: number; interviewRate: number }[];
  bestColdEmailTemplates: { name: string; sent: number; replyRate: number }[];
  bestCompaniesByResponse: { company: string; applications: number; responseRate: number }[];
  bestRoleCategories: { category: string; applications: number; interviewRate: number }[];
  avgDaysApplicationToResponse: number | null;
  avgDaysInterviewToDecision: number | null;
  totalApplications: number;
}

export async function getAnalyticsData(supabase: SupabaseClient, userId: string): Promise<AnalyticsData> {
  const [{ data: applications }, { data: resumes }, { data: outreach }, { data: templates }, { data: statusHistory }] =
    await Promise.all([
      supabase
        .from("applications")
        .select("id, job_title, company_name, status, date_applied, resume_id, source, created_at, updated_at")
        .eq("user_id", userId)
        .eq("is_archived", false),
      supabase.from("resumes").select("id, display_name").eq("user_id", userId).eq("is_archived", false),
      supabase.from("outreach").select("template_id, response_received").eq("user_id", userId),
      supabase.from("email_templates").select("id, name").eq("user_id", userId),
      supabase
        .from("application_status_history")
        .select("application_id, to_status, changed_at")
        .eq("user_id", userId)
        .order("changed_at", { ascending: true }),
    ]);

  const apps = applications ?? [];
  const total = apps.length;

  const months: string[] = [];
  for (let i = 5; i >= 0; i--) months.push(format(startOfMonth(subMonths(new Date(), i)), "yyyy-MM"));
  const applicationVolumeOverTime = months.map((month) => ({
    month: format(new Date(`${month}-01`), "MMM yyyy"),
    count: apps.filter((a) => a.date_applied && a.date_applied.startsWith(month)).length,
  }));

  const progressed = apps.filter((a) => PROGRESSED_STATUSES.includes(a.status)).length;
  const interviewed = apps.filter((a) => INTERVIEW_STATUSES.includes(a.status)).length;
  const offered = apps.filter((a) => a.status === "offer" || a.status === "accepted").length;
  const rejected = apps.filter((a) => a.status === "rejected").length;
  const ghosted = apps.filter((a) => a.status === "ghosted").length;

  const responseRate = total > 0 ? Math.round((progressed / total) * 1000) / 10 : 0;
  const interviewConversionRate = total > 0 ? Math.round((interviewed / total) * 1000) / 10 : 0;
  const offerConversionRate = total > 0 ? Math.round((offered / total) * 1000) / 10 : 0;
  const rejectionRate = total > 0 ? Math.round((rejected / total) * 1000) / 10 : 0;
  const ghostingRate = total > 0 ? Math.round((ghosted / total) * 1000) / 10 : 0;

  const boardCounts = new Map<string, { count: number; interviewed: number }>();
  apps.forEach((a) => {
    const source = a.source?.trim() || "Not specified";
    const entry = boardCounts.get(source) ?? { count: 0, interviewed: 0 };
    entry.count += 1;
    if (INTERVIEW_STATUSES.includes(a.status)) entry.interviewed += 1;
    boardCounts.set(source, entry);
  });
  const bestJobBoards = [...boardCounts.entries()]
    .map(([source, v]) => ({ source, count: v.count, interviewRate: v.count > 0 ? Math.round((v.interviewed / v.count) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const bestResumeVersions = (resumes ?? []).map((r) => {
    const resumeApps = apps.filter((a) => a.resume_id === r.id);
    const resumeInterviewed = resumeApps.filter((a) => INTERVIEW_STATUSES.includes(a.status)).length;
    return {
      name: r.display_name,
      applications: resumeApps.length,
      interviewRate: resumeApps.length > 0 ? Math.round((resumeInterviewed / resumeApps.length) * 100) : 0,
    };
  }).filter((r) => r.applications > 0).sort((a, b) => b.interviewRate - a.interviewRate);

  const templateStats = new Map<string, { name: string; sent: number; replied: number }>();
  (outreach ?? []).forEach((o) => {
    if (!o.template_id) return;
    const name = templates?.find((t) => t.id === o.template_id)?.name ?? "Unknown";
    const entry = templateStats.get(o.template_id) ?? { name, sent: 0, replied: 0 };
    entry.sent += 1;
    if (o.response_received) entry.replied += 1;
    templateStats.set(o.template_id, entry);
  });
  const bestColdEmailTemplates = [...templateStats.values()]
    .map((t) => ({ name: t.name, sent: t.sent, replyRate: t.sent > 0 ? Math.round((t.replied / t.sent) * 100) : 0 }))
    .sort((a, b) => b.replyRate - a.replyRate)
    .slice(0, 6);

  const companyStats = new Map<string, { total: number; progressed: number }>();
  apps.forEach((a) => {
    const entry = companyStats.get(a.company_name) ?? { total: 0, progressed: 0 };
    entry.total += 1;
    if (PROGRESSED_STATUSES.includes(a.status)) entry.progressed += 1;
    companyStats.set(a.company_name, entry);
  });
  const bestCompaniesByResponse = [...companyStats.entries()]
    .map(([company, v]) => ({ company, applications: v.total, responseRate: v.total > 0 ? Math.round((v.progressed / v.total) * 100) : 0 }))
    .filter((c) => c.applications >= 1)
    .sort((a, b) => b.responseRate - a.responseRate)
    .slice(0, 6);

  const categoryStats = new Map<string, { total: number; interviewed: number }>();
  apps.forEach((a) => {
    const category = categorize(a.job_title);
    const entry = categoryStats.get(category) ?? { total: 0, interviewed: 0 };
    entry.total += 1;
    if (INTERVIEW_STATUSES.includes(a.status)) entry.interviewed += 1;
    categoryStats.set(category, entry);
  });
  const bestRoleCategories = [...categoryStats.entries()]
    .map(([category, v]) => ({ category, applications: v.total, interviewRate: v.total > 0 ? Math.round((v.interviewed / v.total) * 100) : 0 }))
    .sort((a, b) => b.applications - a.applications);

  const responseTimes = apps
    .filter((a) => a.date_applied && PROGRESSED_STATUSES.includes(a.status))
    .map((a) => differenceInCalendarDays(new Date(a.updated_at), new Date(a.date_applied!)))
    .filter((d) => d >= 0);
  const avgDaysApplicationToResponse =
    responseTimes.length > 0 ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10 : null;

  const decisionTimes: number[] = [];
  const historyByApp = new Map<string, { to_status: ApplicationStatus; changed_at: string }[]>();
  (statusHistory ?? []).forEach((h) => {
    const list = historyByApp.get(h.application_id) ?? [];
    list.push(h);
    historyByApp.set(h.application_id, list);
  });
  historyByApp.forEach((history) => {
    const firstInterview = history.find((h) => INTERVIEW_STATUSES.includes(h.to_status));
    const decision = [...history].reverse().find((h) => TERMINAL_STATUSES.includes(h.to_status));
    if (firstInterview && decision && decision.changed_at > firstInterview.changed_at) {
      decisionTimes.push(differenceInCalendarDays(new Date(decision.changed_at), new Date(firstInterview.changed_at)));
    }
  });
  const avgDaysInterviewToDecision =
    decisionTimes.length > 0 ? Math.round((decisionTimes.reduce((a, b) => a + b, 0) / decisionTimes.length) * 10) / 10 : null;

  return {
    applicationVolumeOverTime,
    responseRate,
    interviewConversionRate,
    offerConversionRate,
    rejectionRate,
    ghostingRate,
    bestJobBoards,
    bestResumeVersions,
    bestColdEmailTemplates,
    bestCompaniesByResponse,
    bestRoleCategories,
    avgDaysApplicationToResponse,
    avgDaysInterviewToDecision,
    totalApplications: total,
  };
}

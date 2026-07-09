import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfWeek, subWeeks, format, differenceInCalendarDays } from "date-fns";
import type { Application, ApplicationStatus, InterviewRound, FollowUp } from "@/lib/types/database";

const TERMINAL_STATUSES: ApplicationStatus[] = ["rejected", "withdrawn", "ghosted", "accepted"];
const INTERVIEW_STATUSES: ApplicationStatus[] = [
  "recruiter_screen",
  "oa_assessment",
  "first_round",
  "technical_round",
  "superday_final_round",
  "offer",
  "accepted",
];
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

export interface DashboardData {
  totalApplications: number;
  activeApplications: number;
  rejections: number;
  offers: number;
  interviewsScheduledCount: number;
  followUpsDueCount: number;
  overdueFollowUpsCount: number;
  coldEmailsSent: number;
  replyRate: number;
  applicationsThisWeek: number;
  avgResponseTimeDays: number | null;
  topCompanies: { name: string; count: number }[];
  applicationsOverTime: { week: string; count: number }[];
  statusDistribution: { status: ApplicationStatus; count: number }[];
  outreachOverTime: { week: string; sent: number; replied: number }[];
  interviewFunnel: { stage: string; count: number }[];
  resumePerformance: { name: string; applications: number; interviewRate: number }[];
  upcomingInterviews: (InterviewRound & {
    application: Pick<Application, "id" | "job_title" | "company_name"> | null;
  })[];
  overdueFollowUps: FollowUp[];
  isEmpty: boolean;
}

export async function getDashboardData(
  supabase: SupabaseClient,
  userId: string
): Promise<DashboardData> {
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString().slice(0, 10);

  const [applicationsRes, outreachRes, followUpsRes, interviewsRes, resumesRes] =
    await Promise.all([
      supabase
        .from("applications")
        .select(
          "id, job_title, company_name, status, date_applied, resume_id, created_at, updated_at"
        )
        .eq("user_id", userId)
        .eq("is_archived", false),
      supabase
        .from("outreach")
        .select("id, date_sent, response_received")
        .eq("user_id", userId),
      supabase
        .from("follow_ups")
        .select("*")
        .eq("user_id", userId)
        .eq("is_completed", false)
        .order("due_date", { ascending: true }),
      supabase
        .from("interview_rounds")
        .select("*, application:applications(id, job_title, company_name)")
        .eq("user_id", userId)
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(6),
      supabase.from("resumes").select("id, display_name").eq("user_id", userId).eq("is_archived", false),
    ]);

  const applications = (applicationsRes.data ?? []) as (Pick<
    Application,
    "id" | "job_title" | "company_name" | "status" | "date_applied" | "resume_id" | "created_at" | "updated_at"
  >)[];
  const outreach = outreachRes.data ?? [];
  const followUps = (followUpsRes.data ?? []) as FollowUp[];
  const upcomingInterviews = (interviewsRes.data ?? []) as unknown as DashboardData["upcomingInterviews"];
  const resumes = resumesRes.data ?? [];

  const totalApplications = applications.length;
  const activeApplications = applications.filter(
    (a) => !TERMINAL_STATUSES.includes(a.status) && a.status !== "offer"
  ).length;
  const rejections = applications.filter((a) => a.status === "rejected").length;
  const offers = applications.filter((a) => a.status === "offer" || a.status === "accepted").length;
  const applicationsThisWeek = applications.filter(
    (a) => a.date_applied && a.date_applied >= weekStart
  ).length;

  const coldEmailsSent = outreach.length;
  const repliedCount = outreach.filter((o) => o.response_received).length;
  const replyRate = coldEmailsSent > 0 ? Math.round((repliedCount / coldEmailsSent) * 1000) / 10 : 0;

  const overdueFollowUps = followUps.filter((f) => f.due_date < today);
  const followUpsDueCount = followUps.filter((f) => f.due_date <= today).length;

  const responseTimes = applications
    .filter((a) => a.date_applied && PROGRESSED_STATUSES.includes(a.status))
    .map((a) => differenceInCalendarDays(new Date(a.updated_at), new Date(a.date_applied!)))
    .filter((d) => d >= 0);
  const avgResponseTimeDays =
    responseTimes.length > 0
      ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10
      : null;

  const companyCounts = new Map<string, number>();
  applications.forEach((a) => {
    companyCounts.set(a.company_name, (companyCounts.get(a.company_name) ?? 0) + 1);
  });
  const topCompanies = [...companyCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const weeks: string[] = [];
  for (let i = 11; i >= 0; i--) {
    weeks.push(startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 }).toISOString().slice(0, 10));
  }
  const applicationsOverTime = weeks.map((week) => {
    const nextWeek = format(
      new Date(new Date(week).getTime() + 7 * 24 * 60 * 60 * 1000),
      "yyyy-MM-dd"
    );
    const count = applications.filter(
      (a) => a.date_applied && a.date_applied >= week && a.date_applied < nextWeek
    ).length;
    return { week: format(new Date(week), "MMM d"), count };
  });

  const outreachOverTime = weeks.map((week) => {
    const nextWeek = format(
      new Date(new Date(week).getTime() + 7 * 24 * 60 * 60 * 1000),
      "yyyy-MM-dd"
    );
    const rows = outreach.filter((o) => o.date_sent >= week && o.date_sent < nextWeek);
    return {
      week: format(new Date(week), "MMM d"),
      sent: rows.length,
      replied: rows.filter((o) => o.response_received).length,
    };
  });

  const statusOrder: ApplicationStatus[] = [
    "saved",
    "planning_to_apply",
    "applied",
    "referral_requested",
    "hr_contacted",
    "recruiter_screen",
    "oa_assessment",
    "first_round",
    "technical_round",
    "superday_final_round",
    "offer",
    "accepted",
    "rejected",
    "withdrawn",
    "ghosted",
  ];
  const statusDistribution = statusOrder
    .map((status) => ({
      status,
      count: applications.filter((a) => a.status === status).length,
    }))
    .filter((s) => s.count > 0);

  const funnelStages: { stage: string; statuses: ApplicationStatus[] }[] = [
    { stage: "Applied", statuses: ["applied", ...INTERVIEW_STATUSES, "rejected", "withdrawn", "ghosted"] },
    { stage: "Recruiter Screen", statuses: ["recruiter_screen", "oa_assessment", "first_round", "technical_round", "superday_final_round", "offer", "accepted"] },
    { stage: "Interview Rounds", statuses: ["first_round", "technical_round", "superday_final_round", "offer", "accepted"] },
    { stage: "Final Round", statuses: ["superday_final_round", "offer", "accepted"] },
    { stage: "Offer", statuses: ["offer", "accepted"] },
  ];
  const interviewFunnel = funnelStages.map((s) => ({
    stage: s.stage,
    count: applications.filter((a) => s.statuses.includes(a.status)).length,
  }));

  const resumePerformance = resumes.map((r) => {
    const apps = applications.filter((a) => a.resume_id === r.id);
    const interviewed = apps.filter((a) => INTERVIEW_STATUSES.includes(a.status)).length;
    return {
      name: r.display_name,
      applications: apps.length,
      interviewRate: apps.length > 0 ? Math.round((interviewed / apps.length) * 100) : 0,
    };
  });

  const interviewsScheduledCount = upcomingInterviews.length;

  return {
    totalApplications,
    activeApplications,
    rejections,
    offers,
    interviewsScheduledCount,
    followUpsDueCount,
    overdueFollowUpsCount: overdueFollowUps.length,
    coldEmailsSent,
    replyRate,
    applicationsThisWeek,
    avgResponseTimeDays,
    topCompanies,
    applicationsOverTime,
    statusDistribution,
    outreachOverTime,
    interviewFunnel,
    resumePerformance,
    upcomingInterviews,
    overdueFollowUps: overdueFollowUps.slice(0, 5),
    isEmpty: totalApplications === 0,
  };
}

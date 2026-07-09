import Link from "next/link";
import {
  Briefcase,
  Flame,
  XCircle,
  Trophy,
  CalendarClock,
  ListChecks,
  Send,
  Reply,
  TrendingUp,
  Timer,
  Building2,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/data/dashboard";
import { StatTile } from "@/components/dashboard/stat-tile";
import { GlassPanel } from "@/components/shared/glass-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { ApplicationsOverTimeChart } from "@/components/dashboard/charts/applications-over-time-chart";
import { StatusDistributionChart } from "@/components/dashboard/charts/status-distribution-chart";
import { OutreachReplyChart } from "@/components/dashboard/charts/outreach-reply-chart";
import { InterviewFunnelChart } from "@/components/dashboard/charts/interview-funnel-chart";
import { ResumePerformanceChart } from "@/components/dashboard/charts/resume-performance-chart";
import { format } from "date-fns";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const data = await getDashboardData(supabase, user.id);

  if (data.isEmpty) {
    return (
      <div className="mx-auto max-w-2xl pt-16">
        <EmptyState
          icon={Sparkles}
          title="Welcome to ApplyOS"
          description="Your command center is ready. Add your first application to start tracking outreach, interviews, and offers in one place."
          actionLabel="Add your first application"
          actionHref="/applications/add"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your job search, at a glance.</p>
        </div>
        <Button render={<Link href="/applications/add" />} className="gap-2">
          <Sparkles className="h-4 w-4" /> Add Application
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <StatTile label="Total Applications" value={data.totalApplications} icon={Briefcase} accent="blue" delay={0.0} />
        <StatTile label="Active" value={data.activeApplications} icon={Flame} accent="cyan" delay={0.02} />
        <StatTile label="Rejections" value={data.rejections} icon={XCircle} accent="silver" delay={0.04} />
        <StatTile label="Offers" value={data.offers} icon={Trophy} accent="emerald" delay={0.06} />
        <StatTile label="Interviews Scheduled" value={data.interviewsScheduledCount} icon={CalendarClock} accent="amber" delay={0.08} />
        <StatTile label="Follow-ups Due" value={data.followUpsDueCount} icon={ListChecks} accent="cyan" delay={0.1} />
        <StatTile label="Cold Emails Sent" value={data.coldEmailsSent} icon={Send} accent="blue" delay={0.12} />
        <StatTile label="Reply Rate" value={`${data.replyRate}%`} icon={Reply} accent="emerald" delay={0.14} />
        <StatTile label="This Week" value={data.applicationsThisWeek} icon={TrendingUp} accent="cyan" delay={0.16} />
        <StatTile
          label="Avg Response Time"
          value={data.avgResponseTimeDays !== null ? `${data.avgResponseTimeDays}d` : "—"}
          icon={Timer}
          accent="silver"
          delay={0.18}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassPanel className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Applications over time</h2>
            <span className="text-xs text-muted-foreground">Last 12 weeks</span>
          </div>
          <ApplicationsOverTimeChart data={data.applicationsOverTime} />
        </GlassPanel>

        <GlassPanel className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Status distribution</h2>
          <StatusDistributionChart data={data.statusDistribution} />
        </GlassPanel>

        <GlassPanel className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Outreach reply rate</h2>
          <OutreachReplyChart data={data.outreachOverTime} />
        </GlassPanel>

        <GlassPanel className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Interview conversion funnel</h2>
          <InterviewFunnelChart data={data.interviewFunnel} />
        </GlassPanel>

        <GlassPanel className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Resume version performance</h2>
          {data.resumePerformance.length > 0 ? (
            <ResumePerformanceChart data={data.resumePerformance} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Upload resumes and link them to applications to see performance.
            </p>
          )}
        </GlassPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassPanel className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4 text-[var(--blue-accent)]" /> Top companies
          </h2>
          {data.topCompanies.length > 0 ? (
            <ul className="space-y-2.5">
              {data.topCompanies.map((c) => (
                <li key={c.name} className="flex items-center justify-between text-sm">
                  <span className="truncate">{c.name}</span>
                  <span className="text-xs font-medium text-muted-foreground">{c.count} apps</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No applications yet.</p>
          )}
        </GlassPanel>

        <GlassPanel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="h-4 w-4 text-[var(--amber-accent)]" /> Upcoming interviews
            </h2>
            <Link href="/interviews" className="flex items-center gap-0.5 text-xs text-primary hover:underline">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {data.upcomingInterviews.length > 0 ? (
            <ul className="space-y-3">
              {data.upcomingInterviews.map((i) => (
                <li key={i.id} className="text-sm">
                  <p className="truncate font-medium">
                    {i.application?.job_title} <span className="text-muted-foreground">· {i.application?.company_name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {i.round_name} · {i.scheduled_at ? format(new Date(i.scheduled_at), "MMM d, h:mm a") : "TBD"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
          )}
        </GlassPanel>

        <GlassPanel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ListChecks className="h-4 w-4 text-destructive" /> Overdue follow-ups
            </h2>
            <Link href="/follow-ups" className="flex items-center gap-0.5 text-xs text-primary hover:underline">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {data.overdueFollowUps.length > 0 ? (
            <ul className="space-y-3">
              {data.overdueFollowUps.map((f) => (
                <li key={f.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{f.title}</span>
                  <span className="text-xs text-destructive">{format(new Date(f.due_date), "MMM d")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}

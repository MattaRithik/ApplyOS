import {
  TrendingUp,
  Percent,
  CalendarClock,
  XCircle,
  Ghost,
  Timer,
  Trophy,
  Globe,
  FileText,
  Mail,
  Building2,
  Layers,
  BarChart3,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAnalyticsData } from "@/lib/data/analytics";
import { EmptyState } from "@/components/shared/empty-state";
import { StatTile } from "@/components/dashboard/stat-tile";
import { GlassPanel } from "@/components/shared/glass-panel";
import { ApplicationsOverTimeChart } from "@/components/dashboard/charts/applications-over-time-chart";
import { RankedList } from "@/components/analytics/ranked-list";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const data = await getAnalyticsData(supabase, user.id);

  if (data.totalApplications === 0) {
    return (
      <div className="mx-auto max-w-2xl pt-16">
        <EmptyState
          icon={BarChart3}
          title="No analytics yet"
          description="Once you start applying, this page will surface response rates, conversion funnels, and which resumes, templates, and boards actually work."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Deep dive into what&apos;s actually working.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Response Rate" value={`${data.responseRate}%`} icon={Percent} accent="blue" />
        <StatTile label="Interview Conversion" value={`${data.interviewConversionRate}%`} icon={CalendarClock} accent="amber" />
        <StatTile label="Offer Conversion" value={`${data.offerConversionRate}%`} icon={Trophy} accent="emerald" />
        <StatTile label="Rejection Rate" value={`${data.rejectionRate}%`} icon={XCircle} accent="silver" />
        <StatTile label="Ghosting Rate" value={`${data.ghostingRate}%`} icon={Ghost} accent="silver" />
        <StatTile
          label="Avg. App → Response"
          value={data.avgDaysApplicationToResponse !== null ? `${data.avgDaysApplicationToResponse}d` : "—"}
          icon={Timer}
          accent="cyan"
        />
      </div>

      <GlassPanel className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-[var(--blue-accent)]" /> Application volume
          </h2>
          <span className="text-xs text-muted-foreground">Last 6 months</span>
        </div>
        <ApplicationsOverTimeChart
          data={data.applicationVolumeOverTime.map((d) => ({ week: d.month, count: d.count }))}
        />
      </GlassPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassPanel className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Globe className="h-4 w-4 text-[var(--blue-accent)]" /> Best job boards / sources
          </h2>
          <RankedList
            icon={Globe}
            empty="Tag applications with a source to see this."
            items={data.bestJobBoards.map((b) => ({ label: b.source, sub: `${b.interviewRate}% interview · ${b.count} apps`, value: b.interviewRate }))}
          />
        </GlassPanel>

        <GlassPanel className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-[var(--cyan-accent)]" /> Best resume versions
          </h2>
          <RankedList
            icon={FileText}
            empty="Link resumes to applications to see this."
            items={data.bestResumeVersions.map((r) => ({ label: r.name, sub: `${r.interviewRate}% interview · ${r.applications} apps`, value: r.interviewRate }))}
          />
        </GlassPanel>

        <GlassPanel className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Mail className="h-4 w-4 text-[var(--emerald-accent)]" /> Best cold email templates
          </h2>
          <RankedList
            icon={Mail}
            empty="Link templates to outreach to see this."
            items={data.bestColdEmailTemplates.map((t) => ({ label: t.name, sub: `${t.replyRate}% replies · ${t.sent} sent`, value: t.replyRate }))}
          />
        </GlassPanel>

        <GlassPanel className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4 text-[var(--amber-accent)]" /> Best companies by response
          </h2>
          <RankedList
            icon={Building2}
            empty="Not enough data yet."
            items={data.bestCompaniesByResponse.map((c) => ({ label: c.company, sub: `${c.responseRate}% response · ${c.applications} apps`, value: c.responseRate }))}
          />
        </GlassPanel>

        <GlassPanel className="p-5 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Layers className="h-4 w-4 text-[var(--silver-accent)]" /> Best role categories
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <RankedList
              icon={Layers}
              empty="Not enough data yet."
              items={data.bestRoleCategories.map((c) => ({ label: c.category, sub: `${c.interviewRate}% interview · ${c.applications} apps`, value: c.interviewRate }))}
            />
            <div className="flex flex-col justify-center gap-3 rounded-xl border border-border/40 p-4">
              <p className="text-xs text-muted-foreground">Average days from interview to decision</p>
              <p className="text-2xl font-semibold tabular-nums">
                {data.avgDaysInterviewToDecision !== null ? `${data.avgDaysInterviewToDecision} days` : "Not enough data"}
              </p>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

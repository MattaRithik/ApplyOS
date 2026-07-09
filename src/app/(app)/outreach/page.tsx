import { Send, Reply, Percent, ListChecks, Trophy, Building2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/empty-state";
import { StatTile } from "@/components/dashboard/stat-tile";
import { GlassPanel } from "@/components/shared/glass-panel";
import { OutreachTable } from "@/components/outreach/outreach-table";
import { OutreachFormDialog } from "@/components/outreach/outreach-form-dialog";
import { todayISODate, daysAgoISODate } from "@/lib/utils/date";

export default async function OutreachPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: outreach }, { data: contacts }, { data: companies }, { data: templates }] = await Promise.all([
    supabase.from("outreach").select("*").eq("user_id", user.id).order("date_sent", { ascending: false }),
    supabase.from("contacts").select("id, name, company_name, email, linkedin_url").eq("user_id", user.id).order("name"),
    supabase.from("companies").select("id, name").eq("user_id", user.id).order("name"),
    supabase.from("email_templates").select("id, name").eq("user_id", user.id).order("name"),
  ]);

  if (!outreach || outreach.length === 0) {
    return (
      <div className="mx-auto max-w-2xl pt-16">
        <EmptyState
          icon={Send}
          title="No outreach logged yet"
          description="Track every cold email and LinkedIn message you send — replies, follow-ups, and which templates actually work."
        />
        <div className="mt-4 flex justify-center">
          <OutreachFormDialog contactOptions={contacts ?? []} companyOptions={companies ?? []} templateOptions={templates ?? []} />
        </div>
      </div>
    );
  }

  const totalSent = outreach.length;
  const replied = outreach.filter((o) => o.response_received).length;
  const replyRate = totalSent > 0 ? Math.round((replied / totalSent) * 1000) / 10 : 0;
  const today = todayISODate();
  const followUpsPending = outreach.filter((o) => o.follow_up_date && o.follow_up_date <= today && !o.response_received).length;

  const sevenDaysAgo = daysAgoISODate(7);
  const staleContacts = outreach.filter((o) => !o.response_received && o.date_sent <= sevenDaysAgo).slice(0, 6);

  const templateStats = new Map<string, { name: string; sent: number; replied: number }>();
  for (const o of outreach) {
    if (!o.template_id) continue;
    const name = templates?.find((t) => t.id === o.template_id)?.name ?? "Unknown template";
    const entry = templateStats.get(o.template_id) ?? { name, sent: 0, replied: 0 };
    entry.sent += 1;
    if (o.response_received) entry.replied += 1;
    templateStats.set(o.template_id, entry);
  }
  const bestTemplates = [...templateStats.values()]
    .map((t) => ({ ...t, rate: t.sent > 0 ? Math.round((t.replied / t.sent) * 100) : 0 }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5);

  const companyCounts = new Map<string, number>();
  outreach.forEach((o) => {
    if (o.company_name) companyCounts.set(o.company_name, (companyCounts.get(o.company_name) ?? 0) + 1);
  });
  const topCompanies = [...companyCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cold Outreach</h1>
          <p className="text-sm text-muted-foreground">{totalSent} messages logged</p>
        </div>
        <OutreachFormDialog contactOptions={contacts ?? []} companyOptions={companies ?? []} templateOptions={templates ?? []} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Emails Sent" value={totalSent} icon={Send} accent="blue" />
        <StatTile label="Replies Received" value={replied} icon={Reply} accent="emerald" />
        <StatTile label="Reply Rate" value={`${replyRate}%`} icon={Percent} accent="cyan" />
        <StatTile label="Follow-ups Pending" value={followUpsPending} icon={ListChecks} accent="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassPanel className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Trophy className="h-4 w-4 text-[var(--amber-accent)]" /> Best-performing templates
          </h2>
          {bestTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No template-linked outreach yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {bestTemplates.map((t) => (
                <li key={t.name} className="flex items-center justify-between text-sm">
                  <span className="truncate">{t.name}</span>
                  <span className="text-xs font-medium text-muted-foreground">{t.rate}% ({t.sent})</span>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        <GlassPanel className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4 text-[var(--blue-accent)]" /> Most-contacted companies
          </h2>
          {topCompanies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No companies yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {topCompanies.map(([name, count]) => (
                <li key={name} className="flex items-center justify-between text-sm">
                  <span className="truncate">{name}</span>
                  <span className="text-xs font-medium text-muted-foreground">{count} messages</span>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        <GlassPanel className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-destructive" /> No response after 7 days
          </h2>
          {staleContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing stale — nice work.</p>
          ) : (
            <ul className="space-y-2.5">
              {staleContacts.map((o) => (
                <li key={o.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{o.person_name ?? o.company_name ?? "Unknown"}</span>
                  <span className="text-xs text-muted-foreground">{o.date_sent}</span>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      </div>

      <OutreachTable
        outreach={outreach}
        contactOptions={contacts ?? []}
        companyOptions={companies ?? []}
        templateOptions={templates ?? []}
      />
    </div>
  );
}

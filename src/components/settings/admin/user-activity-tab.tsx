"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GlassPanel } from "@/components/shared/glass-panel";
import { formatUsd } from "@/components/settings/admin/stat-card";
import type { ActivityKind, ActivityPage, AdminApplication, AdminParseAttempt } from "@/lib/admin/user-activity";

export function UserActivityTab({ userId }: { userId: string }) {
  return (
    <Tabs defaultValue="applications" className="min-w-0">
      <TabsList aria-label="User activity type">
        <TabsTrigger value="applications">Applications</TabsTrigger>
        <TabsTrigger value="parsing">Parsing history</TabsTrigger>
      </TabsList>
      <TabsContent value="applications">
        <ActivityList key={`${userId}-applications`} userId={userId} kind="applications" />
      </TabsContent>
      <TabsContent value="parsing">
        <ActivityList key={`${userId}-parsing`} userId={userId} kind="parsing" />
      </TabsContent>
    </Tabs>
  );
}

function ActivityList({ userId, kind }: { userId: string; kind: ActivityKind }) {
  const [page, setPage] = React.useState(0);
  const [refresh, setRefresh] = React.useState(0);
  const [result, setResult] = React.useState<ActivityPage<AdminApplication | AdminParseAttempt> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const controller = new AbortController();
    async function fetchActivity() {
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const response = await fetch(`/api/admin/users/${userId}/activity?kind=${kind}&page=${page}&pageSize=10`, {
          cache: "no-store", signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load activity.");
        if (!controller.signal.aborted) setResult(data);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load activity.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void fetchActivity();
    return () => controller.abort();
  }, [userId, kind, page, refresh]);

  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  return (
    <div className="min-w-0 space-y-3" aria-busy={loading}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {kind === "applications" ? "Saved and submitted applications, including archived records." : "Accepted AI parsing requests. Parsing a posting does not mean the user applied."}
        </p>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => setRefresh((n) => n + 1)}>Refresh</Button>
      </div>
      {loading && <p role="status" className="py-6 text-center text-sm text-muted-foreground">Loading activity…</p>}
      {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
      {!loading && !error && result?.entries.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">{kind === "applications" ? "No applications on this page." : "No parsing attempts on this page."}</p>
      )}
      {result?.entries.map((entry) => "company_name" in entry
        ? <ApplicationCard key={entry.id} application={entry} userId={userId} />
        : <ParseCard key={entry.id} attempt={entry} />)}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{result ? `${result.total} records · Page ${page + 1} of ${pages}` : `Page ${page + 1}`}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={loading || page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button size="sm" variant="outline" disabled={loading || !result || page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}

function ApplicationCard({ application: a, userId }: { application: AdminApplication; userId: string }) {
  return (
    <GlassPanel className="min-w-0 space-y-3 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 break-words">
          <p className="font-semibold">{a.company_name}</p>
          <p className="text-sm">{a.job_title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{a.location || "Location not provided"} · {label(a.work_mode || "unknown")}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">{label(a.status)}</Badge>
          {a.is_archived && <Badge variant="outline">Archived</Badge>}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Applied: {a.date_applied || "No application date recorded"} · Added: {dateTime(a.created_at)}</p>
      <PostingLink url={a.job_url} />
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">All application details</summary>
        <div className="mt-3 space-y-4">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold">Application resume</p>
            {a.resume ? (
              <div className="mt-1 space-y-1">
                <p className="break-words text-sm">{a.resume.display_name}{a.resume.file_extension ? `.${a.resume.file_extension}` : ""}</p>
                {a.resume.version_notes && <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{a.resume.version_notes}</p>}
                {a.resume.status === "uploaded" ? (
                  <a
                    href={`/api/admin/users/${userId}/applications/${a.id}/resume`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-9 items-center text-xs text-primary underline"
                  >
                    Open resume in new tab
                  </a>
                ) : <p className="text-xs text-muted-foreground">{a.resume.status === "failed" ? "Resume upload failed." : "Resume is still uploading."}</p>}
              </div>
            ) : <p className="mt-1 text-xs text-muted-foreground">No resume linked, or the linked resume was deleted.</p>}
          </div>
          <Fields value={{
            employment_type: a.employment_type,
            salary_min: a.salary_min, salary_max: a.salary_max, salary_currency: a.salary_currency,
            source: a.source, priority_score: a.priority_score, resume_match_score: a.resume_match_score,
            visa_sponsorship_status: a.visa_sponsorship_status, visa_sponsorship_notes: a.visa_sponsorship_notes,
            follow_up_date: a.follow_up_date, final_result: a.final_result,
            recruiter_name: a.recruiter_name, hr_email: a.hr_email,
            recruiter_linkedin_url: a.recruiter_linkedin_url, hiring_manager_linkedin_url: a.hiring_manager_linkedin_url,
            referral_person: a.referral_person, referral_email: a.referral_email, referral_phone: a.referral_phone,
            required_skills: a.required_skills, preferred_skills: a.preferred_skills, keywords: a.keywords,
            cover_letter_used: a.cover_letter_used, notes: a.notes, job_description: a.job_description,
            created_at: dateTime(a.created_at), updated_at: dateTime(a.updated_at),
          }} />
        </div>
      </details>
    </GlassPanel>
  );
}

function ParseCard({ attempt: a }: { attempt: AdminParseAttempt }) {
  const parsed = a.parsed_result;
  const status = a.status === "success" ? "Succeeded" : a.status === "cache_hit" ? "Succeeded · cached" : a.status === "failed" ? "Failed" : a.status === "pending" ? "Pending · outcome not recorded" : label(a.status);
  return (
    <GlassPanel className="min-w-0 space-y-3 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 break-words">
          <p className="font-semibold">{parsed?.identity?.companyName || "Company not captured"}</p>
          <p className="text-sm">{parsed?.identity?.jobTitle || "Role not captured"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{parsed?.location?.rawLocation || [parsed?.location?.city, parsed?.location?.stateOrRegion, parsed?.location?.country].filter(Boolean).join(", ") || "Location not captured"}</p>
        </div>
        <Badge variant={a.status === "failed" ? "destructive" : "secondary"}>{status}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{dateTime(a.created_at)} · {a.model || "Model not recorded"} · {a.estimated_total_cost_usd != null ? formatUsd(a.estimated_total_cost_usd) : "Cost not recorded"}</p>
      {a.error_category && <p className="text-xs text-destructive">Failure reason: {label(a.error_category)}</p>}
      <PostingLink url={a.job_url} />
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Posting and parsing details</summary>
        <div className="mt-3 space-y-4">
          <Fields value={{ request_id: a.request_id, parser_version: a.parser_schema_version, input_characters: a.input_characters, input_tokens: a.input_tokens, output_tokens: a.output_tokens, total_tokens: a.total_tokens, latency_ms: a.latency_ms, cache_hit: a.cache_hit, retry_or_fallback_used: a.fallback_used }} />
          <div>
            <p className="mb-2 text-xs font-semibold">Submitted job description</p>
            <p className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{a.job_description ?? "Posting text was not retained for this attempt. Historical requests may only have usage metadata."}</p>
          </div>
          {parsed ? (
            <div><p className="mb-2 text-xs font-semibold">Extracted result</p><Fields value={parsed} /></div>
          ) : <p className="text-xs text-muted-foreground">No extracted result was retained for this attempt.</p>}
        </div>
      </details>
    </GlassPanel>
  );
}

function label(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}

function dateTime(value: string) {
  return new Date(value).toLocaleString();
}

function PostingLink({ url }: { url: string | null }) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
  } catch { return null; }
  return <a className="block break-all text-xs text-primary underline" href={url} target="_blank" rel="noopener noreferrer">Open job posting</a>;
}

/** Render stored text as React text nodes, never HTML supplied by a user or model. */
function Fields({ value }: { value: object }) {
  return (
    <dl className="space-y-2 text-xs">
      {Object.entries(value).map(([key, item]) => (
        <div key={key} className="min-w-0">
          <dt className="font-medium">{label(key)}</dt>
          <dd className="mt-0.5 max-h-80 overflow-y-auto whitespace-pre-wrap break-words text-muted-foreground">
            {item == null || item === "" || (Array.isArray(item) && item.length === 0) ? "Not provided"
              : Array.isArray(item) ? item.map((entry, i) => <div key={i}>{typeof entry === "object" && entry !== null ? <Fields value={entry} /> : String(entry)}</div>)
              : typeof item === "object" ? <div className="border-l border-border pl-3"><Fields value={item} /></div>
              : typeof item === "boolean" ? item ? "Yes" : "No" : String(item)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  Check,
  X,
  Copy,
  Search,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Database,
  Zap,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { GlassPanel } from "@/components/shared/glass-panel";
import { cn } from "@/lib/utils";
import { safeHttpUrl } from "@/lib/utils/url";
import type { AiParserApiResponse, AiParserResult, FieldProvenanceStatus } from "@/lib/ai-parser/schema";
import { cleanJobPostingDescription, extractLikelyJobPostingUrl } from "@/lib/ai-parser/deterministic";
import {
  ALL_FIELD_LABELS,
  SYNTHETIC_DEADLINE_KEY,
  SYNTHETIC_RECRUITER_CONTACT_KEY,
  selectSafeFieldsToApply,
  type AcceptableFieldKey,
} from "@/lib/ai-parser/apply-to-form";
import type { ApplicationFormValues } from "@/components/applications/application-form";

const STAGES = [
  "Cleaning pasted job text…",
  "Detecting source platform…",
  "Extracting job details…",
  "Validating fields…",
  "Preparing safe fields…",
];

const EXCLUDED_PATHS = new Set(["identity.recruiterName", "identity.recruiterEmail", "roleContent.applicationDeadline"]);

const GROUP_LABELS: Record<string, string> = {
  identity: "Identity",
  location: "Location",
  employment: "Employment",
  compensation: "Compensation",
  skills: "Skills",
  experienceEducation: "Experience & Education",
  roleContent: "Role Content",
  immigration: "Immigration & Work Authorization",
};

interface AiParserPanelProps {
  jobUrl: string;
  jobDescription: string;
  aiParserEnabled: boolean;
  currentValues: ApplicationFormValues;
  onJobUrlChange: (v: string) => void;
  onJobDescriptionChange: (v: string) => void;
  onParsed: (response: AiParserApiResponse) => void;
  onApply: (result: AiParserResult, acceptedKeys: Set<AcceptableFieldKey>) => void;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const str = String(value);
  return str.trim() === "" ? "—" : str;
}

// Reuses the same semantic colors as the rest of the app (VisaSponsorshipBadge,
// etc.) instead of introducing extra one-off hues — explicit/confirmed reads
// as emerald "good", normalized leans on the site's own primary/brand color
// (never a semantic warning), inferred/uncertain both read as amber/red
// "use caution", and missing stays neutral.
function provenanceBadgeClasses(status: FieldProvenanceStatus): string {
  switch (status) {
    case "explicit":
      return "border-[var(--emerald-accent)]/40 text-[var(--emerald-accent)]";
    case "normalized":
      return "border-primary/40 text-primary";
    case "inferred":
      return "border-[var(--amber-accent)]/40 text-[var(--amber-accent)]";
    case "uncertain":
      return "border-destructive/40 text-destructive";
    case "missing":
    default:
      return "border-border/50 text-muted-foreground";
  }
}

function CopyButton({ text }: { text: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="shrink-0 text-muted-foreground"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => toast.success("Copied."));
      }}
      aria-label="Copy value"
    >
      <Copy className="h-3 w-3" />
    </Button>
  );
}

interface FieldEntry {
  path: string;
  label: string;
  value: unknown;
  status: FieldProvenanceStatus;
  evidence?: string;
}

function buildFieldEntries(result: AiParserResult): Record<string, FieldEntry[]> {
  const groups: Record<string, FieldEntry[]> = {};
  for (const groupKey of Object.keys(GROUP_LABELS)) {
    const group = (result as unknown as Record<string, Record<string, unknown>>)[groupKey];
    if (!group) continue;
    const entries: FieldEntry[] = [];
    for (const [fieldKey, value] of Object.entries(group)) {
      const path = `${groupKey}.${fieldKey}`;
      if (EXCLUDED_PATHS.has(path)) continue;
      const label = ALL_FIELD_LABELS[path] ?? fieldKey;
      const prov = result.provenance[path];
      entries.push({ path, label, value, status: prov?.status ?? "missing", evidence: prov?.evidence });
    }
    // Recruiter contact + deadline get synthetic combined rows appended to their natural group.
    if (groupKey === "identity" && (result.identity.recruiterName || result.identity.recruiterEmail)) {
      entries.push({
        path: SYNTHETIC_RECRUITER_CONTACT_KEY,
        label: "Recruiter Contact",
        value: [result.identity.recruiterName, result.identity.recruiterEmail].filter(Boolean).join(" · "),
        status: result.provenance["identity.recruiterEmail"]?.status ?? result.provenance["identity.recruiterName"]?.status ?? "missing",
      });
    }
    if (groupKey === "roleContent" && result.roleContent.applicationDeadline) {
      entries.push({
        path: SYNTHETIC_DEADLINE_KEY,
        label: "Application Deadline → Follow-up Date",
        value: result.roleContent.applicationDeadline,
        status: result.provenance["roleContent.applicationDeadline"]?.status ?? "missing",
      });
    }
    groups[groupKey] = entries.filter((e) => e.value !== null && e.value !== undefined && !(Array.isArray(e.value) && e.value.length === 0));
  }
  return groups;
}

export function AiParserPanel({
  jobUrl,
  jobDescription,
  aiParserEnabled,
  currentValues,
  onJobUrlChange,
  onJobDescriptionChange,
  onParsed,
  onApply,
}: AiParserPanelProps) {
  const [loading, setLoading] = React.useState(false);
  const [stageIndex, setStageIndex] = React.useState(-1);
  const [response, setResponse] = React.useState<AiParserApiResponse | null>(null);
  const [search, setSearch] = React.useState("");
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  const safeKeys = React.useMemo(
    () => (response ? selectSafeFieldsToApply(response.result, currentValues) : new Set<AcceptableFieldKey>()),
    [response, currentValues]
  );

  if (!aiParserEnabled) {
    return (
      <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-xs text-muted-foreground">
        AI parsing is not enabled for this account.
      </div>
    );
  }

  const handleParse = async (forceRefresh = false) => {
    if (jobDescription.trim().length < 100) {
      toast.error("Paste a fuller job description first (at least ~100 characters).");
      return;
    }
    setLoading(true);
    setResponse(null);
    setStageIndex(0);

    const stageTimer = setInterval(() => {
      setStageIndex((i) => (i < STAGES.length - 1 ? i + 1 : i));
    }, 750);

    try {
      const res = await fetch("/api/ai-parser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, jobUrl: jobUrl || undefined, forceRefresh }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Parsing failed");

      const parsed = json as AiParserApiResponse;
      setResponse(parsed);
      onParsed(parsed);

      // Deterministic cleanup: replace the raw pasted text (page chrome,
      // Apply/Save buttons, alumni callouts, ...) with a version that reads
      // like a real job description — the AI extraction above already saw
      // the messy original, which is fine (it's useful signal), but nothing
      // downstream should end up saving the portal clutter.
      const cleanedDescription = cleanJobPostingDescription(jobDescription);
      if (cleanedDescription && cleanedDescription !== jobDescription) {
        onJobDescriptionChange(cleanedDescription);
      }
      if (!jobUrl.trim()) {
        const detectedUrl = extractLikelyJobPostingUrl(jobDescription);
        if (detectedUrl) onJobUrlChange(detectedUrl);
      }

      toast.success(
        parsed.cacheHit
          ? "Loaded from cache."
          : `Parsed with ${parsed.modelUsed}${parsed.fallbackUsed ? " (after retry)" : ""}.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Parsing failed");
    } finally {
      clearInterval(stageTimer);
      setLoading(false);
      setStageIndex(STAGES.length);
    }
  };

  const toggleGroup = (groupKey: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const groups = response ? buildFieldEntries(response.result) : {};

  const matchesSearch = (entry: FieldEntry) => {
    if (!search.trim()) return true;
    const haystack = `${entry.label} ${formatValue(entry.value)}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  };

  const applySafeFields = () => {
    if (!response) return;
    if (safeKeys.size === 0) {
      toast.error("No fields were confident enough to auto-apply. Review the extracted fields below and fill them in manually.");
      return;
    }
    onApply(response.result, safeKeys);
    toast.success(`Applied ${safeKeys.size} safe field${safeKeys.size === 1 ? "" : "s"} to the form.`);
  };

  const warnings = response?.result.metadata.warnings ?? [];
  const safeJobUrl = safeHttpUrl(jobUrl);

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-3">
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Job URL</Label>
          <div className="flex items-center gap-1.5">
            <Input
              value={jobUrl}
              onChange={(e) => onJobUrlChange(e.target.value)}
              placeholder="https://…"
              className="text-sm"
              aria-label="Job posting URL"
            />
            {safeJobUrl && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                render={<a href={safeJobUrl} target="_blank" rel="noopener noreferrer" aria-label="Open job posting URL in a new tab" title={safeJobUrl} />}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Job description</Label>
          <Textarea
            value={jobDescription}
            onChange={(e) => onJobDescriptionChange(e.target.value)}
            placeholder="Paste the full job posting…"
            rows={7}
            className="text-sm"
            aria-label="Job description text"
          />
        </div>
      </div>

      {response && !loading && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <Badge variant="outline" className="h-4 gap-1 px-1.5 text-[9px] uppercase">
              {response.cacheHit ? <Database className="h-2.5 w-2.5" /> : <Zap className="h-2.5 w-2.5" />}
              {response.cacheHit ? "Cached result" : "Fresh parse"}
            </Badge>
            <Badge variant="outline" className="h-4 px-1.5 text-[9px]">
              {response.modelUsed}
            </Badge>
            {response.fallbackUsed && (
              <Badge variant="outline" className="h-4 px-1.5 text-[9px] text-[var(--amber-accent)]">
                retried
              </Badge>
            )}
            <span>{response.result.parseMeta.latencyMs}ms</span>
            {response.result.metadata.overallConfidence !== null && (
              <span>confidence {Math.round(response.result.metadata.overallConfidence * 100)}%</span>
            )}
          </div>

          {warnings.length > 0 && (
            <div className="space-y-1.5 rounded-xl border border-[var(--amber-accent)]/30 bg-[var(--amber-accent)]/10 p-3">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-[var(--amber-accent)]">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <p>{w}</p>
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search fields…"
              className="h-8 pl-7 text-xs"
              aria-label="Search extracted fields"
            />
          </div>

          <div className="space-y-3">
            {Object.entries(groups).map(([groupKey, entries]) => {
              const visible = entries.filter(matchesSearch);
              if (visible.length === 0) return null;
              const isCollapsed = collapsed.has(groupKey);
              return (
                <div key={groupKey} className="rounded-xl border border-border/50">
                  <button
                    type="button"
                    onClick={() => toggleGroup(groupKey)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                    aria-expanded={!isCollapsed}
                  >
                    <span className="text-xs font-semibold">{GROUP_LABELS[groupKey]}</span>
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      {visible.length} field{visible.length === 1 ? "" : "s"}
                      {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-2 border-t border-border/50 p-2.5">
                      {visible.map((entry) => {
                        const willApply = safeKeys.has(entry.path);
                        const isClassification = entry.status === "inferred" || entry.status === "uncertain";
                        return (
                          <div
                            key={entry.path}
                            className={cn(
                              "rounded-lg border p-2 transition-colors",
                              willApply ? "border-primary/30 bg-primary/5" : "border-border/50 opacity-70"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold">{entry.label}</p>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <Badge variant="outline" className={cn("h-4 px-1 text-[9px] uppercase", provenanceBadgeClasses(entry.status))}>
                                      {entry.status}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "h-4 px-1 text-[9px] uppercase",
                                        willApply
                                          ? "border-[var(--emerald-accent)]/40 text-[var(--emerald-accent)]"
                                          : "border-border/50 text-muted-foreground"
                                      )}
                                    >
                                      {willApply ? "will apply" : "skipped"}
                                    </Badge>
                                  </div>
                                </div>
                                <p className="mt-0.5 truncate text-xs text-muted-foreground" title={formatValue(entry.value)}>
                                  {formatValue(entry.value)}
                                </p>
                                {isClassification && (
                                  <p className="mt-0.5 text-[10px] italic text-[var(--amber-accent)]">
                                    Model-generated {entry.status === "uncertain" ? "guess" : "inference"} — not a verified fact from the posting.
                                  </p>
                                )}
                                <div className="mt-1 flex items-center gap-1.5">
                                  <CopyButton text={formatValue(entry.value)} />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {response.result.quantRelevance && (
            <GlassPanel className="space-y-2 p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                AI relevance classifications <span className="font-normal italic">(model opinion, not extracted facts)</span>
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                {Object.entries(response.result.quantRelevance)
                  .filter(([, v]) => v !== null)
                  .map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1">
                      <span className="capitalize text-muted-foreground">{k.replace(/Relevance$/, "").replace(/([A-Z])/g, " $1").trim()}</span>
                      <span className="font-semibold tabular-nums">{v}</span>
                    </div>
                  ))}
              </div>
            </GlassPanel>
          )}
        </motion.div>
      )}

      {!response && !loading && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <X className="h-3 w-3" /> No results yet — paste a description and parse.
        </p>
      )}

      {/* Sticky action bar — always reachable without scrolling through a long
          pasted description or a long extracted-fields list. Cycles through
          three states: idle (Parse), loading (progress steps), done (Apply). */}
      <div className="sticky bottom-0 -mx-4 mt-auto border-t border-border bg-card px-4 py-3">
        <AnimatePresence mode="wait" initial={false}>
          {loading ? (
            <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1.5">
              {STAGES.map((stage, i) => (
                <div key={stage} className="flex items-center gap-2 text-xs">
                  {i < stageIndex ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-[var(--emerald-accent)]" />
                  ) : i === stageIndex ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                  ) : (
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-border/60" />
                  )}
                  <span className={cn(i > stageIndex && "text-muted-foreground")}>{stage}</span>
                </div>
              ))}
            </motion.div>
          ) : response ? (
            <motion.div key="apply" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Button onClick={applySafeFields} className="flex-1 gap-2">
                  <Check className="h-4 w-4" /> Apply Safe Fields to Form
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleParse(true)}
                  aria-label="Force a fresh parse, bypassing the cache"
                  title="Force a fresh parse, bypassing the cache"
                >
                  <Zap className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-center text-[10px] text-muted-foreground">
                Only safe, explicit fields will be applied. Uncertain fields are skipped — review them above.
              </p>
            </motion.div>
          ) : (
            <motion.div key="parse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Button onClick={() => handleParse(false)} disabled={loading} className="w-full gap-2">
                <Sparkles className="h-4 w-4" /> Parse with AI
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

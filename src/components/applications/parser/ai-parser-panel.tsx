"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  Check,
  ArrowRight,
  ClipboardPaste,
  FileText,
  Link2,
  Copy,
  Search,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
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
  const resultsRef = React.useRef<HTMLDivElement>(null);
  const descriptionId = React.useId();
  const urlId = React.useId();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [stageIndex, setStageIndex] = React.useState(-1);
  const [response, setResponse] = React.useState<AiParserApiResponse | null>(null);
  const [search, setSearch] = React.useState("");
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  const safeKeys = React.useMemo(
    () => (response ? selectSafeFieldsToApply(response.result, currentValues) : new Set<AcceptableFieldKey>()),
    [response, currentValues]
  );

  React.useEffect(() => {
    if (response && resultsRef.current?.getClientRects().length) {
      resultsRef.current.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [response]);

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
    if (loading) return;
    setError(null);
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
      setError(e instanceof Error ? e.message : "Parsing failed. Please try again.");
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

  const updateDescription = (value: string) => {
    setResponse(null);
    setError(null);
    onJobDescriptionChange(value);
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast.error("Your clipboard is empty. Copy a job posting first.");
        return;
      }
      updateDescription(text);
    } catch {
      toast.error("Clipboard access is unavailable. Paste directly into the job description.");
    }
  };

  const characterCount = jobDescription.trim().length;

  return (
    <div className="flex flex-col gap-5">
      <ol aria-label="Parser steps" className="flex items-center gap-3 text-xs sm:gap-5 sm:text-sm">
        <li className={cn("flex items-center gap-2", response ? "text-muted-foreground" : "font-medium text-foreground")} aria-current={!response ? "step" : undefined}>
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-xs text-primary">{response ? <Check className="size-3.5" /> : "1"}</span>
          Paste posting
        </li>
        <li role="presentation" aria-hidden="true" className="h-px w-6 bg-border sm:w-10" />
        <li className={cn("flex items-center gap-2", response ? "font-medium text-foreground" : "text-muted-foreground")} aria-current={response ? "step" : undefined}>
          <span className={cn("flex size-6 items-center justify-center rounded-full text-xs", response ? "bg-primary/15 text-primary" : "border border-border")}>2</span>
          Review & apply
        </li>
      </ol>

      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-background/35 shadow-[inset_0_1px_0_var(--glass-highlight)] focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10">
          <div className="flex items-center justify-between gap-2 px-4 pt-3">
            <Label htmlFor={descriptionId} className="flex items-center gap-2 text-sm font-medium">
              <FileText className="size-4 text-primary" /> Job description
            </Label>
            <Button type="button" variant="ghost" size="sm" className="gap-1.5 rounded-full text-muted-foreground" onClick={pasteFromClipboard} disabled={loading}>
              <ClipboardPaste className="size-3.5" /> Paste
            </Button>
          </div>
          <Textarea
            id={descriptionId}
            value={jobDescription}
            onChange={(e) => updateDescription(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                if (!loading && characterCount >= 100) void handleParse(false);
              }
            }}
            placeholder={"Paste the full job posting here…\n\nInclude the role, company, responsibilities, and requirements. We’ll pick out the details for you."}
            disabled={loading}
            rows={8}
            className="h-[clamp(180px,28dvh,300px)] min-h-0 resize-none field-sizing-fixed rounded-none border-0 bg-transparent px-4 py-4 text-base leading-relaxed shadow-none focus-visible:ring-0 md:text-sm dark:bg-transparent"
            aria-describedby={`${descriptionId}-hint`}
            aria-label="Job description text"
          />
          <div id={`${descriptionId}-hint`} className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 px-4 py-2.5 text-xs text-muted-foreground">
            <span>{characterCount < 100 ? "At least 100 characters to get started" : "Ready to parse"}</span>
            <span className="tabular-nums">{characterCount.toLocaleString()} characters</span>
          </div>
        </div>
        <div>
          <Label htmlFor={urlId} className="mb-2 flex items-center gap-2 text-sm font-medium">Job posting link <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Link2 className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id={urlId}
                value={jobUrl}
                disabled={loading}
                onChange={(e) => { setResponse(null); setError(null); onJobUrlChange(e.target.value); }}
                placeholder="https://company.com/careers/role"
                className="h-11 rounded-xl bg-background/30 pl-10 text-base md:text-sm"
                aria-label="Job posting URL"
              />
            </div>
            {safeJobUrl && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0 rounded-xl"
                render={<a href={safeJobUrl} target="_blank" rel="noopener noreferrer" aria-label="Open job posting URL in a new tab" title={safeJobUrl} />}
              >
                <ExternalLink className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      {response && !loading && (
        <motion.div ref={resultsRef} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="scroll-mt-5 space-y-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Your job details, organized.</h3>
            <p className="mt-1 text-sm text-muted-foreground">{safeKeys.size} fields ready to add. Review the details below.</p>
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

      {/* Sticky action bar — always reachable without scrolling through a long
          pasted description or a long extracted-fields list. Cycles through
          three states: idle (Parse), loading (progress steps), done (Apply). */}
      <div className="sticky bottom-0 z-10 -mx-[var(--parser-gutter,1rem)] mt-auto border-t border-border/60 bg-[var(--glass-bg-strong)] px-[var(--parser-gutter,1rem)] py-4 backdrop-blur-xl sm:py-5">
        <AnimatePresence mode="wait" initial={false}>
          {loading ? (
            <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="status" aria-live="polite" className="space-y-1.5">
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
                <Button type="button" onClick={applySafeFields} disabled={safeKeys.size === 0} className="h-12 flex-1 gap-2 rounded-xl">
                  <Check className="h-4 w-4" /> Apply {safeKeys.size} fields to form
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleParse(true)}
                  className="size-12 rounded-xl"
                  aria-label="Parse again"
                  title="Force a fresh parse, bypassing the cache"
                >
                  <Zap className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Only safe, explicit fields will be applied. Uncertain fields are skipped — review them above.
              </p>
            </motion.div>
          ) : (
            <motion.div key="parse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-[260px] text-xs leading-relaxed text-muted-foreground">You’ll review the extracted details before adding them to your form.</p>
                <Button type="button" onClick={() => handleParse(false)} disabled={loading || characterCount < 100} className="h-12 w-full gap-2 rounded-xl px-6 shadow-lg shadow-primary/10 sm:w-auto">
                  <Sparkles className="size-4" /> Parse job posting <ArrowRight className="size-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

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
  AlertTriangle,
  Zap,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { safeHttpUrl } from "@/lib/utils/url";
import type { AiParserApiResponse, AiParserResult } from "@/lib/ai-parser/schema";
import { cleanJobPostingDescription, extractLikelyJobPostingUrl } from "@/lib/ai-parser/deterministic";
import {
  selectSafeFieldsToApply,
  SYNTHETIC_EMPLOYMENT_KEY,
  type AcceptableFieldKey,
} from "@/lib/ai-parser/apply-to-form";
import { ParserActivity } from "@/components/applications/parser/parser-activity";
import { ParsedFieldsReview } from "@/components/applications/parser/parsed-fields-review";
import type { ApplicationFormValues } from "@/components/applications/application-form";

interface AiParserPanelProps {
  jobUrl: string;
  jobDescription: string;
  aiParserEnabled: boolean;
  currentValues: ApplicationFormValues;
  preservePriority?: boolean;
  onJobUrlChange: (v: string) => void;
  onJobDescriptionChange: (v: string) => void;
  onParsed: (response: AiParserApiResponse) => void;
  onApply: (result: AiParserResult, acceptedKeys: Set<AcceptableFieldKey>) => void;
}

export function AiParserPanel({
  jobUrl,
  jobDescription,
  aiParserEnabled,
  currentValues,
  preservePriority = false,
  onJobUrlChange,
  onJobDescriptionChange,
  onParsed,
  onApply,
}: AiParserPanelProps) {
  const activityRef = React.useRef<HTMLDivElement>(null);
  const resultsRef = React.useRef<HTMLDivElement>(null);
  const descriptionId = React.useId();
  const urlId = React.useId();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [response, setResponse] = React.useState<AiParserApiResponse | null>(null);

  const safeKeys = React.useMemo(
    () => (response ? selectSafeFieldsToApply(response.result, currentValues, preservePriority) : new Set<AcceptableFieldKey>()),
    [response, currentValues, preservePriority]
  );

  React.useEffect(() => {
    if (response && resultsRef.current?.getClientRects().length) {
      resultsRef.current.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [response]);

  React.useEffect(() => {
    if (loading && activityRef.current?.getClientRects().length) activityRef.current.scrollIntoView({ block: "start", behavior: "instant" });
  }, [loading]);

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
      setLoading(false);
    }
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

  const employmentType = response?.result.employment.employmentType;
  const employmentLabels: Record<string, string> = { full_time: "Full time", part_time: "Part time", internship: "Internship", contract: "Contract", temporary: "Temporary", seasonal: "Seasonal", apprenticeship: "Apprenticeship", unknown: "Not confirmed" };
  const employmentSource = response?.result.provenance["employment.employmentType"];
  const canCorrectEmployment = employmentSource?.status === "explicit" && employmentType && ["full_time", "part_time", "internship", "contract", "temporary"].includes(employmentType) && currentValues.employment_type && currentValues.employment_type !== employmentType;
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

      <details open={!response && !loading} className="rounded-xl border border-border/50 p-3 sm:p-4">
        <summary className="cursor-pointer text-sm font-medium">{loading ? "View submitted posting" : response ? "View or change the source posting" : "Job posting"}</summary>
        <div className="mt-4 space-y-4">
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
          <Label htmlFor={urlId} className="mb-2 flex items-center gap-2 text-sm font-medium">Job posting link <span className="font-normal text-muted-foreground">(optional · saved as a reference)</span></Label>
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

      </details>

      {loading && <div ref={activityRef} className="scroll-mt-5"><ParserActivity characterCount={characterCount} /></div>}

      {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      {response && !loading && (
        <motion.div ref={resultsRef} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="scroll-mt-5 space-y-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Review the complete extraction</h3>
            <p className="mt-1 text-sm text-muted-foreground">{safeKeys.size} fields can fill your form. Every extracted detail is available below and is saved when you save the application.</p>
          </div>

          <div className="space-y-2 rounded-xl border border-border/60 bg-background/25 p-4">
            <p className="text-sm font-medium">Employment type: {employmentLabels[employmentType ?? "unknown"] ?? "Not confirmed"}</p>
            {employmentSource?.evidence && <p className="whitespace-pre-wrap text-xs text-muted-foreground">Posting says: “{employmentSource.evidence}”</p>}
            {canCorrectEmployment && <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Your form currently says {employmentLabels[currentValues.employment_type!] ?? currentValues.employment_type}.</p>
              <Button size="sm" variant="outline" onClick={() => onApply(response.result, new Set([...safeKeys, SYNTHETIC_EMPLOYMENT_KEY]))}>Use {employmentLabels[employmentType!]}</Button>
            </div>}
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

          {response.result.priorityMatch?.score != null && !safeKeys.has("priorityMatch.score") && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
            <p className="text-sm">Suggested priority: <strong>{response.result.priorityMatch.score}/100</strong>. Your current score is kept unless you choose to replace it.</p>
            <Button variant="outline" size="sm" onClick={() => onApply(response.result, new Set(["priorityMatch.score"]))}>Use suggested priority</Button>
          </div>}
          <ParsedFieldsReview result={response.result} safePaths={safeKeys} />
        </motion.div>
      )}

      {/* Sticky action bar — always reachable without scrolling through a long
          pasted description or a long extracted-fields list. Cycles through
          three states: idle (Parse), loading (extraction status), done (Apply). */}
      <div className="sticky bottom-0 z-10 -mx-[var(--parser-gutter,1rem)] mt-auto border-t border-border/60 bg-[var(--glass-bg-strong)] px-[var(--parser-gutter,1rem)] py-4 backdrop-blur-xl sm:py-5">
        <AnimatePresence mode="wait" initial={false}>
          {loading ? (
            <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="status" aria-live="polite" className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin text-primary motion-reduce:animate-none" /> Waiting for your complete report…</div>
              <p className="text-xs text-muted-foreground">You can review every extracted field as soon as the response is ready.</p>
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
                Only supported, confidently extracted fields fill the form. The complete report, including uncertain and additional details, is saved with your application.
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

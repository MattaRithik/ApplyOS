"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  Check,
  CheckCheck,
  X,
  Copy,
  Search,
  AlertTriangle,
  CircleAlert,
  Pencil,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GlassPanel } from "@/components/shared/glass-panel";
import { cn } from "@/lib/utils";
import type { JobExtraction, JobIntelligenceResult } from "@/lib/parser/schema";
import { EXTRACTION_FIELD_LABELS, type AcceptableFieldKey } from "@/lib/parser/apply-to-form";

const STAGES = [
  "Reading posting…",
  "Extracting company…",
  "Extracting requirements…",
  "Checking sponsorship…",
  "Finding keywords…",
  "Building structured job profile…",
];

interface JobIntelligencePanelProps {
  jobUrl: string;
  jobDescription: string;
  resumeOptions: { id: string; display_name: string }[];
  formResumeId?: string | null;
  onJobUrlChange: (v: string) => void;
  onJobDescriptionChange: (v: string) => void;
  onParsed: (result: JobIntelligenceResult) => void;
  onApply: (
    extraction: JobExtraction,
    suggestedFollowUpDate: string | undefined,
    priorityScore: number | undefined,
    acceptedKeys: Set<AcceptableFieldKey>
  ) => void;
}

function omitKey<T extends Record<string, string>>(obj: T, key: string): T {
  const next = { ...obj };
  delete next[key];
  return next;
}

function confidenceBucket(confidence: number): "High" | "Medium" | "Low" {
  if (confidence >= 75) return "High";
  if (confidence >= 45) return "Medium";
  return "Low";
}

function confidenceClasses(confidence: number) {
  if (confidence >= 75) return "bg-[var(--emerald-accent)] text-[var(--emerald-accent)]";
  if (confidence >= 45) return "bg-[var(--amber-accent)] text-[var(--amber-accent)]";
  return "bg-destructive text-destructive";
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
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
      aria-label="Copy"
    >
      <Copy className="h-3 w-3" />
    </Button>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <GlassPanel className="space-y-1 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </GlassPanel>
  );
}

function SuggestionCard({ label, text }: { label: string; text?: string }) {
  if (!text) return null;
  return (
    <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <CopyButton text={text} />
      </div>
      <p className="text-xs leading-relaxed">{text}</p>
    </div>
  );
}

export function JobIntelligencePanel({
  jobUrl,
  jobDescription,
  resumeOptions,
  formResumeId,
  onJobUrlChange,
  onJobDescriptionChange,
  onParsed,
  onApply,
}: JobIntelligencePanelProps) {
  const [loading, setLoading] = React.useState(false);
  const [stageIndex, setStageIndex] = React.useState(-1);
  const [result, setResult] = React.useState<JobIntelligenceResult | null>(null);
  const [accepted, setAccepted] = React.useState<Set<AcceptableFieldKey>>(new Set());
  const [search, setSearch] = React.useState("");
  const [editing, setEditing] = React.useState<Record<string, string>>({});
  const [resumeId, setResumeId] = React.useState<string | null>(formResumeId ?? null);

  const handleParse = async () => {
    if (!jobDescription.trim()) {
      toast.error("Paste a job description first.");
      return;
    }
    setLoading(true);
    setResult(null);
    setStageIndex(0);

    const stageTimer = setInterval(() => {
      setStageIndex((i) => (i < STAGES.length - 1 ? i + 1 : i));
    }, 850);

    try {
      const res = await fetch("/api/job-parser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, jobUrl, resumeId: resumeId || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Parsing failed");

      const parsed = json as JobIntelligenceResult;
      setResult(parsed);
      onParsed(parsed);

      const defaultAccepted = new Set<AcceptableFieldKey>();
      for (const [key, field] of Object.entries(parsed.extraction)) {
        if (field && typeof field === "object" && "confidence" in field && (field as { confidence: number }).confidence >= 60) {
          defaultAccepted.add(key as AcceptableFieldKey);
        }
      }
      setAccepted(defaultAccepted);

      const sourceLabel =
        parsed.meta.source === "cache"
          ? "Loaded from cache."
          : parsed.meta.source === "heuristic"
            ? "Parsed with the built-in parser (AI unavailable)."
            : `Parsed with AI (${parsed.meta.modelUsed}).`;
      toast.success(sourceLabel);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Parsing failed");
    } finally {
      clearInterval(stageTimer);
      setLoading(false);
      setStageIndex(STAGES.length);
    }
  };

  const toggleField = (key: AcceptableFieldKey) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const fieldEntries = result
    ? (Object.entries(result.extraction) as [keyof JobExtraction, NonNullable<JobExtraction[keyof JobExtraction]>][])
    : [];

  const filteredFieldEntries = fieldEntries.filter(([key, field]) => {
    if (!search.trim()) return true;
    const haystack = `${EXTRACTION_FIELD_LABELS[key]} ${formatValue(field.value)}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  const acceptAll = () => setAccepted(new Set(fieldEntries.map(([key]) => key)));
  const acceptHighConfidence = () =>
    setAccepted(new Set(fieldEntries.filter(([, f]) => f.confidence >= 75).map(([key]) => key)));
  const rejectAll = () => setAccepted(new Set());

  const applyAccepted = () => {
    if (!result || accepted.size === 0) return;
    // Editing overrides win over the originally-extracted value.
    const extractionWithEdits: JobExtraction = { ...result.extraction };
    for (const [key, editedValue] of Object.entries(editing)) {
      const original = extractionWithEdits[key as keyof JobExtraction];
      if (original) {
        (extractionWithEdits as Record<string, unknown>)[key] = { ...original, value: editedValue };
      }
    }
    onApply(extractionWithEdits, result.intelligence.suggestedFollowUpDate, result.intelligence.priorityScore, accepted);
    toast.success(`Applied ${accepted.size} field${accepted.size === 1 ? "" : "s"} to the form.`);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Job URL</Label>
          <Input value={jobUrl} onChange={(e) => onJobUrlChange(e.target.value)} placeholder="https://…" className="text-sm" />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Job description</Label>
          <Textarea
            value={jobDescription}
            onChange={(e) => onJobDescriptionChange(e.target.value)}
            placeholder="Paste the full job posting…"
            rows={7}
            className="text-sm"
          />
        </div>
        {resumeOptions.length > 0 && (
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Match against resume (optional)</Label>
            <select
              value={resumeId ?? ""}
              onChange={(e) => setResumeId(e.target.value || null)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">— No resume selected —</option>
              {resumeOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.display_name}
                </option>
              ))}
            </select>
          </div>
        )}
        <Button onClick={handleParse} disabled={loading} className="w-full gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Analyzing…" : "Analyze with AI"}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {loading && (
          <motion.ul
            key="stages"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-1.5 rounded-xl border border-border/50 bg-muted/30 p-3"
          >
            {STAGES.map((stage, i) => (
              <li key={stage} className="flex items-center gap-2 text-xs">
                {i < stageIndex ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-[var(--emerald-accent)]" />
                ) : i === stageIndex ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-border/60" />
                )}
                <span className={cn(i > stageIndex && "text-muted-foreground")}>{stage}</span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {result && !loading && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {result.duplicate.isDuplicate && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>Possible duplicate — matched on {result.duplicate.matchedOn?.join(", ") || "company/title"}.</p>
            </div>
          )}

          {result.warnings.length > 0 && (
            <div className="space-y-1.5 rounded-xl border border-[var(--amber-accent)]/30 bg-[var(--amber-accent)]/10 p-3">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-[var(--amber-accent)]">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <p>{w}</p>
                </div>
              ))}
            </div>
          )}

          <Tabs defaultValue="fields">
            <TabsList className="w-full">
              <TabsTrigger value="fields" className="flex-1">
                Extracted Fields
              </TabsTrigger>
              <TabsTrigger value="insights" className="flex-1">
                AI Insights
              </TabsTrigger>
            </TabsList>

            <TabsContent value="fields" className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search fields…"
                    className="h-8 pl-7 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Button variant="ghost" size="xs" className="gap-1" onClick={acceptAll}>
                  <CheckCheck className="h-3 w-3" /> Accept all
                </Button>
                <Button variant="ghost" size="xs" className="gap-1" onClick={acceptHighConfidence}>
                  <Check className="h-3 w-3" /> Accept high-confidence
                </Button>
                <Button variant="ghost" size="xs" className="gap-1 text-destructive" onClick={rejectAll}>
                  <X className="h-3 w-3" /> Reject all
                </Button>
              </div>

              <div className="max-h-[420px] space-y-2 overflow-y-auto scrollbar-thin pr-1">
                {filteredFieldEntries.map(([key, field]) => {
                  const isAccepted = accepted.has(key);
                  const isEditing = key in editing;
                  return (
                    <div
                      key={key}
                      className={cn(
                        "rounded-xl border p-2.5 transition-colors",
                        isAccepted ? "border-primary/30 bg-primary/5" : "border-border/50 opacity-70"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <Checkbox checked={isAccepted} onCheckedChange={() => toggleField(key)} className="mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold">{EXTRACTION_FIELD_LABELS[key]}</p>
                            <div className="flex shrink-0 items-center gap-1">
                              <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase">
                                {field.source}
                              </Badge>
                              <span className="text-[10px] tabular-nums text-muted-foreground">
                                {confidenceBucket(field.confidence)} · {field.confidence}%
                              </span>
                            </div>
                          </div>

                          {isEditing ? (
                            <Input
                              autoFocus
                              value={editing[key]}
                              onChange={(e) => setEditing((prev) => ({ ...prev, [key]: e.target.value }))}
                              onBlur={() => setEditing((prev) => (prev[key] === "" ? omitKey(prev, key) : prev))}
                              className="mt-1 h-7 text-xs"
                            />
                          ) : (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground" title={formatValue(field.value)}>
                              {formatValue(field.value)}
                            </p>
                          )}

                          <div className="mt-1.5 flex items-center gap-1.5">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn("h-full rounded-full", confidenceClasses(field.confidence).split(" ")[0])}
                                style={{ width: `${field.confidence}%` }}
                              />
                            </div>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() =>
                                setEditing((prev) =>
                                  isEditing ? omitKey(prev, key) : { ...prev, [key]: formatValue(field.value) }
                                )
                              }
                              aria-label="Edit value"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <CopyButton text={formatValue(field.value)} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredFieldEntries.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">No fields match your search.</p>
                )}
              </div>

              <Button onClick={applyAccepted} disabled={accepted.size === 0} className="w-full gap-2" variant="secondary">
                <ChevronRight className="h-4 w-4" /> Apply {accepted.size} field{accepted.size === 1 ? "" : "s"} to form
              </Button>
            </TabsContent>

            <TabsContent value="insights" className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {result.intelligence.resumeMatchPercent !== undefined && (
                  <StatCard label="Resume Match" value={`${result.intelligence.resumeMatchPercent}%`} />
                )}
                {result.intelligence.priorityScore !== undefined && (
                  <StatCard label="Priority Score" value={result.intelligence.priorityScore} />
                )}
                {result.intelligence.applicationSuccessScore !== undefined && (
                  <StatCard label="Success Score" value={result.intelligence.applicationSuccessScore} />
                )}
                {result.intelligence.roleFitScore !== undefined && (
                  <StatCard label="Role Fit" value={result.intelligence.roleFitScore} />
                )}
                {result.intelligence.companyPrestigeScore !== undefined && (
                  <StatCard label="Company Prestige" value={result.intelligence.companyPrestigeScore} />
                )}
                {result.intelligence.networkingOpportunityScore !== undefined && (
                  <StatCard label="Networking Opportunity" value={result.intelligence.networkingOpportunityScore} />
                )}
                {result.intelligence.estimatedDifficulty && (
                  <StatCard label="Difficulty" value={result.intelligence.estimatedDifficulty.replace("_", " ")} />
                )}
                {result.intelligence.estimatedCompetition && (
                  <StatCard label="Competition" value={result.intelligence.estimatedCompetition.replace("_", " ")} />
                )}
              </div>

              {result.intelligence.successScoreReason && (
                <SuggestionCard label="Why this score" text={result.intelligence.successScoreReason} />
              )}
              <SuggestionCard label="Suggested Resume Version" text={result.intelligence.suggestedResumeVersion} />
              <SuggestionCard label="Suggested Cover Letter Focus" text={result.intelligence.suggestedCoverLetterFocus} />
              <SuggestionCard label="Suggested Cold Email Angle" text={result.intelligence.suggestedColdEmailAngle} />
              <SuggestionCard label="Suggested LinkedIn Message" text={result.intelligence.suggestedLinkedInMessage} />

              {result.intelligence.suggestedInterviewTopics && result.intelligence.suggestedInterviewTopics.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Suggested Interview Topics</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.intelligence.suggestedInterviewTopics.map((topic) => (
                      <Badge key={topic} variant="outline">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {result.resumeComparison && (
                <div className="space-y-2 rounded-xl border border-border/50 p-3">
                  <p className="text-xs font-semibold">Resume Comparison</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <p>
                      Overall match: <span className="font-semibold">{result.resumeComparison.overallMatchPercent}%</span>
                    </p>
                    <p>
                      Keyword coverage: <span className="font-semibold">{result.resumeComparison.keywordCoveragePercent}%</span>
                    </p>
                  </div>
                  {result.resumeComparison.topResumeStrengths.length > 0 && (
                    <p className="text-xs">
                      <span className="font-semibold text-[var(--emerald-accent)]">Strengths: </span>
                      {result.resumeComparison.topResumeStrengths.join(", ")}
                    </p>
                  )}
                  {result.resumeComparison.topResumeWeaknesses.length > 0 && (
                    <p className="text-xs">
                      <span className="font-semibold text-destructive">Gaps: </span>
                      {result.resumeComparison.topResumeWeaknesses.join(", ")}
                    </p>
                  )}
                  {result.resumeComparison.recommendedImprovements.length > 0 && (
                    <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                      {result.resumeComparison.recommendedImprovements.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {result.tags.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Suggested Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-center text-[10px] text-muted-foreground">
                {result.meta.modelUsed} · {result.meta.processingTimeMs}ms · v{result.meta.parserVersion}
              </p>
            </TabsContent>
          </Tabs>
        </motion.div>
      )}

      {!result && !loading && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <X className="h-3 w-3" /> No results yet — paste a description and analyze.
        </p>
      )}
    </div>
  );
}

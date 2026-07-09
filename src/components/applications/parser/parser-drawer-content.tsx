"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, Check, X, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { ParsedJobResult } from "@/lib/parser/types";
import { PARSER_FIELD_LABELS } from "@/lib/parser/apply-to-form";

interface ParserDrawerContentProps {
  jobUrl: string;
  jobDescription: string;
  onJobUrlChange: (v: string) => void;
  onJobDescriptionChange: (v: string) => void;
  onApply: (parsed: ParsedJobResult, acceptedKeys: Set<keyof ParsedJobResult>) => void;
}

function confidenceColor(confidence: number) {
  if (confidence >= 75) return "bg-[var(--emerald-accent)]";
  if (confidence >= 45) return "bg-[var(--amber-accent)]";
  return "bg-destructive";
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export function ParserDrawerContent({
  jobUrl,
  jobDescription,
  onJobUrlChange,
  onJobDescriptionChange,
  onApply,
}: ParserDrawerContentProps) {
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<ParsedJobResult | null>(null);
  const [accepted, setAccepted] = React.useState<Set<keyof ParsedJobResult>>(new Set());

  const handleParse = async () => {
    if (!jobDescription.trim()) {
      toast.error("Paste a job description first.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/parser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, jobUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Parsing failed");
      const parsed = json.result as ParsedJobResult;
      setResult(parsed);
      setAccepted(new Set(Object.keys(parsed) as (keyof ParsedJobResult)[]));
      toast.success(
        json.source === "llm" ? "Parsed with AI." : "Parsed with the built-in heuristic parser."
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Parsing failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleField = (key: keyof ParsedJobResult) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const acceptAll = () => {
    if (!result) return;
    setAccepted(new Set(Object.keys(result) as (keyof ParsedJobResult)[]));
  };

  const applyAccepted = () => {
    if (!result || accepted.size === 0) return;
    onApply(result, accepted);
    toast.success(`Applied ${accepted.size} field${accepted.size === 1 ? "" : "s"} to the form.`);
  };

  type NonNullField = NonNullable<ParsedJobResult[keyof ParsedJobResult]>;
  const fieldEntries = result
    ? (Object.entries(result) as [keyof ParsedJobResult, NonNullField][])
    : [];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Job URL</Label>
          <Input
            value={jobUrl}
            onChange={(e) => onJobUrlChange(e.target.value)}
            placeholder="https://…"
            className="text-sm"
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Job description
          </Label>
          <Textarea
            value={jobDescription}
            onChange={(e) => onJobDescriptionChange(e.target.value)}
            placeholder="Paste the full job posting…"
            rows={8}
            className="text-sm"
          />
        </div>
        <Button onClick={handleParse} disabled={loading} className="w-full gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Parsing…" : "Parse with AI"}
        </Button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">
                {fieldEntries.length} fields extracted
              </p>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={acceptAll}>
                <CheckCheck className="h-3.5 w-3.5" /> Accept all
              </Button>
            </div>

            <div className="max-h-[420px] space-y-2 overflow-y-auto scrollbar-thin pr-1">
              {fieldEntries.map(([key, field]) => {
                const isAccepted = accepted.has(key);
                return (
                  <div
                    key={key}
                    className={cn(
                      "rounded-xl border p-2.5 transition-colors",
                      isAccepted ? "border-primary/30 bg-primary/5" : "border-border/50 opacity-60"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={isAccepted}
                        onCheckedChange={() => toggleField(key)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold">{PARSER_FIELD_LABELS[key]}</p>
                          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                            {field.confidence}%
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={formatValue(field.value)}>
                          {formatValue(field.value)}
                        </p>
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", confidenceColor(field.confidence))}
                            style={{ width: `${field.confidence}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button onClick={applyAccepted} disabled={accepted.size === 0} className="w-full gap-2" variant="secondary">
              <Check className="h-4 w-4" /> Apply {accepted.size} field{accepted.size === 1 ? "" : "s"} to form
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {!result && !loading && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <X className="h-3 w-3" /> No results yet — paste a description and parse.
        </p>
      )}
    </div>
  );
}

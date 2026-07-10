import type { VisaSponsorshipStatus } from "@/lib/types/database";

/**
 * Deterministic, conservative visa-sponsorship classifier. Never guesses —
 * falls back to "not_mentioned" unless the text contains an unambiguous
 * signal, since a wrong guess here (e.g. claiming sponsorship where there is
 * none) is worse than no answer at all.
 */
export function classifyVisaStatus(text: string): { status: VisaSponsorshipStatus; confidence: number; evidence: string | null } {
  const negativeSponsor =
    /\b(no|not|unable to|will not|won'?t|cannot|does not)\b[^.\n]{0,25}\bsponsor/i;
  const noFutureSponsor = /\bsponsorship\b[^.\n]{0,40}\bnot\s+(available|offered|provided)/i;
  const requiresAuth =
    /\bmust\s+(already\s+)?(be|have)\b[^.\n]{0,40}\b(authoriz|eligib)/i;
  const h1bPositive = /\b(h-?1b)\b[^.\n]{0,40}\bsponsor/i;
  const h1bGeneralPositive = /\bsponsor(s|ship)?\b[^.\n]{0,40}\b(h-?1b)\b/i;
  const futurePossible =
    /\b(may|could|potentially|possibly)\b[^.\n]{0,40}\bsponsor/i;
  const optPositive = /\bopt\b[^.\n]{0,30}\b(accepted|eligible|welcome|authorized|ok|ok)\b/i;
  const cptPositive = /\bcpt\b[^.\n]{0,30}\b(accepted|eligible|welcome|authorized)\b/i;

  const findEvidence = (re: RegExp) => text.match(re)?.[0]?.trim().slice(0, 200) ?? null;

  if (negativeSponsor.test(text) || noFutureSponsor.test(text)) {
    return { status: "no_sponsorship", confidence: 85, evidence: findEvidence(negativeSponsor) ?? findEvidence(noFutureSponsor) };
  }
  if (h1bPositive.test(text) || h1bGeneralPositive.test(text)) {
    return { status: "h1b_available", confidence: 85, evidence: findEvidence(h1bPositive) ?? findEvidence(h1bGeneralPositive) };
  }
  if (optPositive.test(text)) {
    return { status: "opt_accepted", confidence: 75, evidence: findEvidence(optPositive) };
  }
  if (cptPositive.test(text)) {
    return { status: "cpt_accepted", confidence: 75, evidence: findEvidence(cptPositive) };
  }
  if (futurePossible.test(text) && /sponsor/i.test(text)) {
    return { status: "future_possible", confidence: 60, evidence: findEvidence(futurePossible) };
  }
  if (requiresAuth.test(text)) {
    return { status: "requires_existing_auth", confidence: 70, evidence: findEvidence(requiresAuth) };
  }

  return { status: "not_mentioned", confidence: 95, evidence: null };
}

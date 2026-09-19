/** Role-specific schedules outrank job-board chips and company-wide benefits. */
export interface WorkplaceEvidence {
  value: "remote" | "hybrid" | "onsite" | "unknown";
  evidence: string;
}

export function detectWorkplace(text: string): WorkplaceEvidence | null {
  const candidates: { value: WorkplaceEvidence["value"]; evidence: string; rank: number }[] = [];
  const clauses = text.split(/\n|(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  for (const clause of clauses) {
    // These describe technology, amenities, interviews, or a menu of policies, not this role.
    const cleaned = clause.replace(/\b(?:not|no|non)[- ]+(?:a\s+)?(?:fully\s+)?(?:remote|hybrid|on[- ]?site)\b/gi, "").replace(/\bhybrid\s+(?:cloud|AI|technology|infrastructure|modeling)\b/gi, "");
    if (/depending on (?:the )?role|dependent on role|for (?:most|some|certain) (?:roles|positions)|roles? (?:may|can) (?:be|work) (?:onsite|hybrid)|does not apply to|transitioning|rollout/i.test(cleaned)) continue;
    const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    const days = cleaned.match(/\b([1-5]|one|two|three|four|five)\s*days?\s*(?:(?:a|per)\s*week|\/\s*week)?\s*(?:working\s+)?(?:in|at|from)\s+(?:the\s+)?office(?:\s*(?:a|per)\s*week)?/i)
      ?? cleaned.match(/\b(?:in[- ]office|in (?:the )?office|on[- ]?site)\s+(?:attendance\s+)?(?:for\s+)?(?:at least\s+)?([1-5]|one|two|three|four|five)\s*days?\s*(?:(?:a|per)\s*week|\/\s*week)/i);
    if (days && /\bweek\b/i.test(cleaned)) {
      const count = words[days[1].toLowerCase()] ?? Number(days[1]);
      candidates.push({ value: count === 5 ? "onsite" : "hybrid", evidence: clause, rank: 4 });
      continue;
    }
    if (/\b(?:on[- ]?site|in[- ]person|in[- ]office)\s+(?:gym|health|wellness|interview|training|event|examiner)/i.test(cleaned)
      && !/\b(?:this|the)\s+(?:role|position|job)\s+(?:is|requires|will|must)/i.test(cleaned)) continue;
    const isRole = /\b(?:this|the)\s+(?:role|position|job)\b|\b(?:remote|hybrid|on[- ]?site)\s+(?:role|position|job)\b|\bwork (?:arrangement|schedule|location)\b|\blocation\s*:/i.test(cleaned);
    const isWork = isRole || /\b(?:work|working|workforce|office|employees|teams|schedule|home)\b/i.test(cleaned);
    const chip = /^(?:remote|hybrid|on[- ]?site|in[- ]office)(?:\s+position)?$/i.test(cleaned);
    if (!isWork && !chip) continue;
    const types: WorkplaceEvidence["value"][] = [];
    if (/\bhybrid\b|\bwork(?:ing)? from home\s+(?:[1-4]|one|two|three|four)\s*days?/i.test(cleaned)) types.push("hybrid");
    if (/\b(?:fully|100%)\s+remote\b|\bremote[- ]first\b|\bwork from anywhere\b|\bremote (?:position|role|job)\b|^remote$|\b(?:role|position|job|location|arrangement)\s*(?:is|:|will be)\s*remote\b|\bwork(?:ing)?\s+remotely\b|\bwork(?:ing)? from home\b/i.test(cleaned)) types.push("remote");
    if (/\b(?:on[- ]?site|in[- ]office|in[- ]person)\b/i.test(cleaned)) types.push("onsite");
    if (types.includes("hybrid")) {
      // A hybrid sentence commonly includes an in-office component.
      candidates.push({ value: "hybrid", evidence: clause, rank: isRole ? 3 : chip ? 1 : 2 });
    } else if (types.length === 1) {
      candidates.push({ value: types[0], evidence: clause, rank: isRole ? 3 : chip ? 1 : 2 });
    }
  }
  if (!candidates.length) return null;
  const rank = Math.max(...candidates.map((c) => c.rank));
  const strongest = candidates.filter((c) => c.rank === rank);
  const values = new Set(strongest.map((c) => c.value));
  return { value: values.size === 1 ? strongest[0].value : "unknown", evidence: strongest.map((c) => c.evidence).join("; ").slice(0, 300) };
}

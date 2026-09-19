import type { CompensationGroup, LocationGroup, ProvenanceMap } from "@/lib/ai-parser/schema";

type Period = CompensationGroup["salaryPeriod"];
interface PayCandidate {
  minimum: number;
  maximum: number;
  currency: string | null;
  period: Period;
  evidence: string;
  context: string;
  index: number;
  contextStart: number;
}

const AMOUNT = String.raw`\d+(?:,\d{3})*(?:\.\d+)?\s*[kK]?`;
const CURRENCY = String.raw`(?:USD\s*\$?|CAD\s*\$?|GBP\s*£?|EUR\s*€?|AUD\s*\$?|SGD\s*\$?|US\$|CA\$|C\$|A\$|\$|£|€)`;
const UNIT = String.raw`(?:\s*(?:\/|per\s+)\s*(?:hour|hr|h|day|week|wk|month|mo|year|yr|annum)\b)?`;
const PAY_RE = new RegExp(String.raw`(?<![\w.,])(?<currency>${CURRENCY})?\s*(?<low>${AMOUNT})${UNIT}(?:\s*(?:-|–|—|to)\s*(?<currency2>${CURRENCY})?\s*(?<high>${AMOUNT})${UNIT})?(?!(?:[\w,]|\.\d))`, "gi");

function amount(value: string, inheritK = false): number {
  const k = /k\s*$/i.test(value) || inheritK;
  return Number(value.replace(/[,\sKk]/g, "")) * (k ? 1000 : 1);
}

function currencyOf(text: string): string | null {
  if (/\bCAD\b|CA\$|C\$/i.test(text)) return "CAD";
  if (/\bUSD\b|US\$/i.test(text)) return "USD";
  if (/\bGBP\b|£/i.test(text)) return "GBP";
  if (/\bEUR\b|€/i.test(text)) return "EUR";
  if (/\bAUD\b|A\$/i.test(text)) return "AUD";
  if (/\bSGD\b/i.test(text)) return "SGD";
  return null;
}

function periodOf(text: string): Period {
  if (/\/(?:h|hr|hour)\b|per hour|hourly/i.test(text)) return "hour";
  if (/\/day\b|per day|daily/i.test(text)) return "day";
  if (/\/(?:wk|week)\b|per week|weekly/i.test(text)) return "week";
  if (/\/(?:mo|month)\b|per month|monthly/i.test(text)) return "month";
  if (/\/(?:yr|year)\b|per (?:year|annum)|annual|yearly/i.test(text)) return "year";
  return "unknown";
}

export function payCandidates(text: string): PayCandidate[] {
  const candidates: PayCandidate[] = [];
  for (const match of text.matchAll(PAY_RE)) {
    const { low, high, currency, currency2 } = match.groups!;
    const start = match.index! + match[0].length - match[0].trimStart().length;
    const end = match.index! + match[0].length;
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const nextLine = text.indexOf("\n", end);
    const context = text.slice(lineStart, nextLine < 0 ? text.length : nextLine);
    const preceding = text.slice(Math.max(lineStart, start - 70), start);
    // Accept monetary amounts or an explicitly labeled pay line, never years, dates, or AUM.
    const payLabel = text.slice(Math.max(0, start - 100), start);
    if (!currency && !currency2 && !/\b(?:salary|compensation|pay range|wages|hourly rate)[^\d$£€]{0,50}$/i.test(payLabel)
      && periodOf(match[0]) === "unknown") continue;
    if (/assets|under management|revenue|portfolio size|billion/i.test(context)
      && !/salary|base pay|wage|pay range|hourly rate/i.test(context)) continue;
    if (/\b(?:bonus|equity|tuition|relocation allowance|median)[^$£€\d]*$/i.test(preceding)) continue;
    const inheritK = !!high && /k\s*$/i.test(high) && !/[,\.k]/i.test(low) && Number(low) < 1000;
    const minimum = amount(low, inheritK);
    const maximum = high ? amount(high) : minimum;
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum < 0 || maximum < minimum) continue;
    // Currency belongs to this pay clause, not a different location elsewhere in the posting.
    const local = text.slice(start, end + 12);
    const before = text.slice(lineStart, start).split(/(?<=[.!?])\s+/).at(-1) ?? "";
    const after = text.slice(end, nextLine < 0 ? text.length : nextLine).split(/[.;!\n]/)[0];
    const periodContext = `${before} ${match[0]} ${after}`;
    const currencyCodes = new Set([currencyOf(currency ?? ""), currencyOf(currency2 ?? ""), currencyOf(local)].filter(Boolean));
    candidates.push({ minimum, maximum, currency: currencyCodes.size === 1 ? [...currencyCodes][0]! : null,
      period: periodOf(match[0]) !== "unknown" ? periodOf(match[0]) : periodOf(periodContext),
      evidence: match[0].trim(), context: periodContext.trim(), index: start, contextStart: start - before.length });
  }
  return candidates;
}

/** Bind the amount, currency and period to one actual pay statement. Never combine locations. */
export function validateCompensation(compensation: CompensationGroup, location: LocationGroup, text: string): {
  compensation: CompensationGroup; provenance: ProvenanceMap; warning?: string; resolvedMultipleRanges?: boolean;
} {
  const result = { ...compensation };
  const provenance: ProvenanceMap = {};
  const candidates = payCandidates(text);
  const unique = [...new Map(candidates.map((c) => [JSON.stringify([c.minimum, c.maximum, c.currency, c.period]), c])).values()];
  let selected: PayCandidate | undefined;
  if (unique.length === 1) {
    selected = unique[0];
  } else if (unique.length > 1) {
    // Use a location explicitly present before the pay section, not a location guessed from its ranges.
    const firstPayClause = Math.min(...candidates.map((c) => c.contextStart));
    const heading = text.slice(0, firstPayClause).toLowerCase();
    const primary = [location.city, location.rawLocation].filter((v): v is string => !!v && v.length > 2 && heading.includes(v.toLowerCase()));
    const matched = unique.filter((c) => primary.some((v) => c.context.toLowerCase().includes(v.toLowerCase())));
    if (matched.length === 1) selected = matched[0];
    // A fixed hourly rate alongside its annualized equivalent is not a location conflict.
    if (!selected && /annualized/i.test(text)) {
      const hourly = unique.filter((c) => c.period === "hour");
      if (hourly.length === 1 && unique.every((c) => c.period === "hour" || c.period === "year")) selected = hourly[0];
    }
  }
  const hadAmounts = result.salaryMinimum !== null || result.salaryMaximum !== null;
  if (!selected) {
    if (hadAmounts || unique.length > 1) {
      result.salaryMinimum = null;
      result.salaryMaximum = null;
      result.salaryCurrency = null;
      result.salaryPeriod = "unknown";
      for (const field of ["salaryMinimum", "salaryMaximum", "salaryCurrency", "salaryPeriod"]) {
        provenance[`compensation.${field}`] = { status: "uncertain" };
      }
      return { compensation: result, provenance, warning: unique.length > 1
        ? "Multiple pay ranges are listed. Review the location, role and pay period before filling salary."
        : "Salary values could not be matched to a stated pay amount. Review the compensation text." };
    }
    return { compensation: result, provenance };
  }

  const bounded = selected.minimum !== selected.maximum;
  // A single amount can be a floor, ceiling, or fixed rate; preserve explicit bounds.
  if (bounded) {
    result.salaryMinimum = selected.minimum;
    result.salaryMaximum = selected.maximum;
  } else {
    const beforeAmount = selected.context.slice(0, selected.context.indexOf(selected.evidence));
    const floor = /starting (?:at|from)|minimum|at least|from\s*:?\s*$/i.test(beforeAmount);
    const ceiling = /up to|maximum|at most/i.test(beforeAmount);
    result.salaryMinimum = ceiling && !floor ? null : selected.minimum;
    result.salaryMaximum = floor && !ceiling ? null : selected.maximum;
  }
  const explicitCurrencies = new Set(candidates.map((c) => c.currency).filter(Boolean));
  let localCurrency = selected.currency;
  if (!localCurrency) {
    // Bare '$' is ambiguous. Only resolve it using a location literally present in the posting.
    const country = location.country?.toLowerCase() ?? "";
    const cityIsStated = !!location.city && text.toLowerCase().includes(location.city.toLowerCase());
    if ((cityIsStated || /\bcanada\b/i.test(text)) && /^(?:ca|canada)$/.test(country)) localCurrency = "CAD";
    else if (cityIsStated && /^(?:us|usa|united states|united states of america)$/.test(country)) localCurrency = "USD";
    else if (explicitCurrencies.size === 0 && /\b(?:united states|usa|u\.s\.)\b/i.test(text) && !/\b(?:canada|australia|singapore)\b/i.test(text)) localCurrency = "USD";
  }
  result.salaryCurrency = localCurrency;
  result.salaryPeriod = selected.period;
  if (unique.length > 1) {
    // Keep literal pay clauses, not a model's now-obsolete explanation that fields are blank.
    result.compensationText = [...new Set(candidates.map((c) => c.context))].join(" ").slice(0, 500);
    provenance["compensation.compensationText"] = { status: "explicit", evidence: selected.context.slice(0, 300) };
  }
  for (const field of ["salaryMinimum", "salaryMaximum"] as const) {
    if (result[field] !== null) provenance[`compensation.${field}`] = { status: "explicit", evidence: selected.context.slice(0, 300) };
  }
  provenance["compensation.salaryCurrency"] = { status: localCurrency ? "normalized" : "missing", evidence: selected.context.slice(0, 300) };
  provenance["compensation.salaryPeriod"] = { status: selected.period === "unknown" ? "uncertain" : "explicit", evidence: selected.context.slice(0, 300) };
  return { compensation: result, provenance, resolvedMultipleRanges: unique.length > 1 };
}

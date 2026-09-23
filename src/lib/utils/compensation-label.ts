/** An internship may pay a salary. Only use Stipend when the pay terms say so. */
export function compensationLabel(text: string | null | undefined): "Salary" | "Stipend" {
  if (!text || /\b(?:base\s+(?:pay|salary)|salary\s+range|annual\s+salary)\b|\bsalary\s*:/i.test(text)) return "Salary";
  const stipendClause = text.split(/[\n.!?]/).find((line) =>
    /\bstipend\s*(?::|of\b|range\b)|\b(?:monthly|weekly|annual|hourly|daily)\s+stipend\b/i.test(line) &&
    !/\b(?:housing|relocation|travel|meal|equipment|wellness|internet|home office)\b/i.test(line)
  );
  return stipendClause ? "Stipend" : "Salary";
}

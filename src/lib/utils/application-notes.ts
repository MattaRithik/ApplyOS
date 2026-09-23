/** Remove only the legacy parser banner, preserving the actual notes. */
export function cleanApplicationNotes(notes: string): string {
  return notes.replace(/^[ \t]*— Parsed from job description —[ \t]*(?:\r?\n(?:\r?\n)?|$)/gm, "");
}

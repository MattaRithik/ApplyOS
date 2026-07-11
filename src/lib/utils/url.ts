/** Returns only browser-safe HTTP(S) URLs for user-controlled links. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function safeMailto(value: string | null | undefined): string | null {
  if (!value || /[\r\n\u0000-\u001f\u007f]/.test(value)) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? `mailto:${value}` : null;
}

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

const UNSAFE_MAILTO_CHARS = /[\r\n\x00-\x1f\x7f]/;

export function safeMailto(value: string | null | undefined): string | null {
  if (!value || UNSAFE_MAILTO_CHARS.test(value)) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  // Encode URI delimiters so an address cannot inject bcc/subject/body parameters.
  return `mailto:${encodeURIComponent(value).replace(/%40/g, "@")}`;
}

/** Shortens a URL for display (strips protocol/www, truncates the middle) — the real href/value is unaffected. */
export function formatShortUrl(value: string, maxLen = 46): string {
  let display = value.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  display = display.replace(/\/$/, "");
  if (display.length <= maxLen) return display;
  const head = Math.ceil((maxLen - 1) * 0.6);
  const tail = maxLen - 1 - head;
  return `${display.slice(0, head)}…${display.slice(display.length - tail)}`;
}
/** Shared by browser navigation and the server-side authentication callback. */
export function safeLocalPath(value: string | null, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const base = "https://local.invalid";
    const url = new URL(value, base);
    if (url.origin !== base || url.pathname.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

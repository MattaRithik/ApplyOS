import "server-only";
export { safeLocalPath } from "@/lib/utils/url";

const JSON_CONTENT_TYPE = "application/json";

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 | 415; error: string };

/**
 * Reject browser-initiated cross-site mutations. Supabase's SameSite
 * cookies already provide a baseline CSRF defense; checking Fetch Metadata
 * and Origin here keeps that protection explicit at every route boundary.
 */
export function isSameOriginMutation(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return !fetchSite || fetchSite === "same-origin" || fetchSite === "none";

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

/** Reads and parses a bounded JSON body without ever reflecting parser errors. */
export async function readJsonBody(request: Request, maxBytes = 64 * 1024): Promise<JsonBodyResult> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== JSON_CONTENT_TYPE) {
    return { ok: false, status: 415, error: "Content-Type must be application/json." };
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, status: 413, error: "Request body is too large." };
  }

  if (!request.body) return { ok: false, status: 400, error: "Invalid request body." };
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  let bytesRead = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        // Do not wait for an attacker-controlled stream to finish cancelling.
        void reader.cancel().catch(() => {});
        return { ok: false, status: 413, error: "Request body is too large." };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    void reader.cancel().catch(() => {});
    return { ok: false, status: 400, error: "Invalid request body." };
  } finally {
    reader.releaseLock();
  }

  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON body." };
  }
}

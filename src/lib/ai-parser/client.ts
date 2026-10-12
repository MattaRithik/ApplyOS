import "server-only";
import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

/**
 * Lazily-constructed singleton OpenAI client. Throws a clear server-side
 * error if OPENAI_API_KEY is missing — callers (the API route) must catch
 * this and return a generic message to the client, never the raw error.
 */
export function getOpenAIClient(): OpenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }
  // Retry policy belongs to service.ts; SDK retries would multiply billed
  // calls and can outlive the API route's 60-second execution window.
  cachedClient = new OpenAI({ apiKey, maxRetries: 0, timeout: 25_000 });
  return cachedClient;
}

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
  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

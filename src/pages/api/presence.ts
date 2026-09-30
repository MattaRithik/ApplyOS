import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient, serializeCookieHeader } from "@supabase/ssr";
import { Readable } from "node:stream";
import { TLSSocket } from "node:tls";
import { recordHeartbeat } from "@/lib/presence/heartbeat";

// Keep the raw stream for the shared, bounded JSON reader. Pages API routes
// expose the connection socket; App Router Request objects do not.
export const config = { api: { bodyParser: false } };

export default async function presence(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader("Cache-Control", "private, no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }
  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    }
    const https = (request.socket instanceof TLSSocket && request.socket.encrypted)
      || (process.env.VERCEL === "1" && request.headers["x-forwarded-proto"] === "https");
    const url = new URL("/api/presence", `${https ? "https" : "http"}://${request.headers.host || "localhost"}`);
    const webRequest = new Request(url, {
      method: "POST", headers,
      body: Readable.toWeb(request) as ReadableStream<Uint8Array>,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: {
        getAll: () => Object.entries(request.cookies).map(([name, value]) => ({ name, value: value ?? "" })),
        setAll: (cookies) => {
          const existing = response.getHeader("Set-Cookie");
          const previous = typeof existing === "string" ? [existing] : Array.isArray(existing) ? existing : [];
          response.setHeader("Set-Cookie", [...previous, ...cookies.map(({ name, value, options }) => serializeCookieHeader(name, value, options))]);
        },
      } },
    );
    const result = await recordHeartbeat(webRequest, request.socket.remoteAddress, supabase);
    result.headers.forEach((value, name) => response.setHeader(name, value));
    response.status(result.status).send(await result.text());
  } catch {
    response.status(503).json({ error: "Activity service unavailable." });
  }
}

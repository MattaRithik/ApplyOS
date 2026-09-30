import { afterEach, describe, expect, it, vi } from "vitest";
import { connectionDetails, heartbeatSchema } from "./server";
import { pageSection, presenceStatus, type PresenceSession } from "./shared";

afterEach(() => vi.unstubAllEnvs());
describe("presence data boundaries", () => {
  it("drops content IDs, query strings, fragments, and unknown paths", () => {
    expect(pageSection("/applications/private-id?secret=yes#notes")).toBe("applications");
    expect(pageSection("/unknown/private")).toBe("other");
  });
  it("rejects forged identities and raw paths", () => {
    const body = { sessionId: "00000000-0000-4000-8000-000000000001", page: "dashboard", visible: true, closed: false, idleSeconds: 0 };
    expect(heartbeatSchema.safeParse(body).success).toBe(true);
    expect(heartbeatSchema.safeParse({ ...body, user_id: "victim" }).success).toBe(false);
    expect(heartbeatSchema.safeParse({ ...body, page: "/applications/secret" }).success).toBe(false);
    expect(heartbeatSchema.safeParse({ ...body, idleSeconds: -1 }).success).toBe(false);
  });
  it("does not trust forwarding headers off Vercel", () => {
    vi.stubEnv("VERCEL", "");
    expect(connectionDetails(new Request("http://localhost", { headers: { "x-vercel-forwarded-for": "1.2.3.4", "x-vercel-ip-city": "Fake" } })))
      .toMatchObject({ ip_address: null, location: null });
  });
  it("validates Vercel IP and safely decodes approximate location", () => {
    vi.stubEnv("VERCEL", "1");
    expect(connectionDetails(new Request("https://app.test", { headers: { "x-vercel-forwarded-for": "2001:db8::1", "x-vercel-ip-city": "New%20York", "x-vercel-ip-country": "US" } })))
      .toMatchObject({ ip_address: "2001:db8::1", location: "New York, US" });
    expect(connectionDetails(new Request("https://app.test", { headers: { "x-vercel-forwarded-for": "bad-ip", "x-vercel-ip-city": "%bad" } })))
      .toMatchObject({ ip_address: null, location: null });
  });
  it("expires stale sessions and distinguishes visible, idle, background, and closed tabs", () => {
    const now = Date.parse("2026-09-29T12:00:00Z");
    const row = { last_seen_at: new Date(now).toISOString(), last_active_at: new Date(now).toISOString(), visible: true, closed: false } as PresenceSession;
    expect(presenceStatus(row, now)).toBe("Active");
    expect(presenceStatus({ ...row, visible: false }, now)).toBe("Background");
    expect(presenceStatus({ ...row, last_active_at: new Date(now - 60000).toISOString() }, now)).toBe("Idle");
    expect(presenceStatus(row, now + 45000)).toBe("Offline");
    expect(presenceStatus({ ...row, closed: true }, now)).toBe("Offline");
  });
});

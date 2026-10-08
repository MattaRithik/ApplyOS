import { afterEach, describe, expect, it, vi } from "vitest";
import { connectionDetails, heartbeatSchema } from "./server";
import { formatLastContact, pageSection, presenceStatus, summarizePresence, type PresenceSession } from "./shared";

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
  it.each(["127.0.0.1", "::1", "192.168.1.50"])("shows development IP %s", (ip) => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(connectionDetails(new Request("http://localhost", { headers: { "x-forwarded-for": ip } })))
      .toMatchObject({ ip_address: ip, location: null });
  });
  it("does not trust development forwarding headers in production", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(connectionDetails(new Request("https://app.test", { headers: { "x-forwarded-for": "8.8.8.8" } })).ip_address).toBeNull();
  });
  it("uses validated Vercel fallbacks and never substitutes the proxy socket", () => {
    vi.stubEnv("VERCEL", "1");
    const request = new Request("https://app.test", { headers: { "x-vercel-forwarded-for": "invalid", "x-real-ip": "203.0.113.9" } });
    expect(connectionDetails(request).ip_address).toBe("203.0.113.9");
    expect(connectionDetails(new Request("https://app.test", { headers: { "x-forwarded-for": "2001:db8::2" } })).ip_address).toBe("2001:db8::2");
    expect(connectionDetails(new Request("https://app.test")).ip_address).toBeNull();
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
    expect(presenceStatus({ ...row, last_active_at: null }, now)).toBe("Idle");
    expect(presenceStatus({ ...row, last_active_at: new Date(now - 60000).toISOString() }, now)).toBe("Idle");
    expect(presenceStatus(row, now + 45000)).toBe("Offline");
    expect(presenceStatus({ ...row, closed: true }, now)).toBe("Offline");
  });
});

describe("user online summary", () => {
  const now = Date.parse("2026-10-07T19:43:00Z");
  const session = {
    user_id: "user-1", profile_name: "DP", session_id: "tab-1",
    last_seen_at: new Date(now).toISOString(), last_active_at: new Date(now - 10000).toISOString(),
    visible: true, closed: false,
  } as PresenceSession;

  it.each([
    ["background", { visible: false }],
    ["uninteracted", { last_active_at: null }],
    ["idle", { last_active_at: new Date(now - 60000).toISOString() }],
    ["closed", { closed: true }],
    ["stale", { last_seen_at: new Date(now - 45000).toISOString() }],
  ])("does not show a %s tab as online", (_, overrides) => {
    expect(summarizePresence([{ ...session, ...overrides }], now)[0].isOnline).toBe(false);
  });

  it("counts the user once when any tab has recent visible interaction", () => {
    const background = { ...session, session_id: "tab-2", visible: false, last_active_at: new Date(now - 3600000).toISOString() };
    const [user] = summarizePresence([background, session], now);
    expect(user).toMatchObject({ isOnline: true, last_active_at: session.last_active_at });
    expect(summarizePresence([background, session], now)).toHaveLength(1);
  });

  it("uses the latest interaction across tabs rather than background report times", () => {
    const older = { ...session, closed: true, last_seen_at: new Date(now - 30000).toISOString() };
    const background = { ...session, session_id: "tab-2", visible: false, last_active_at: new Date(now - 3600000).toISOString() };
    expect(summarizePresence([background, older], now)[0]).toMatchObject({ isOnline: false, last_active_at: older.last_active_at });
  });
  it("does not replace a known interaction with a newly opened tab", () => {
    const untouched = { ...session, session_id: "new-tab", last_active_at: null };
    expect(summarizePresence([untouched], now)[0]).toMatchObject({ isOnline: false, last_active_at: null });
    expect(summarizePresence([untouched, session], now)[0]).toMatchObject({ isOnline: true, last_active_at: session.last_active_at });
  });
});

describe("last report labels", () => {
  const time = "2026-09-30T00:00:00Z";
  it.each([[0, "Just now"], [20, "Just now"], [59, "Just now"], [60, "1m ago"], [125, "2m ago"], [3600, "1h ago"], [61690, "17h ago"], [86400, "1d ago"], [90000, "1d ago"]])("formats %s seconds as %s", (seconds, expected) => {
    expect(formatLastContact(time, Date.parse(time) + Number(seconds) * 1000)).toBe(expected);
  });
});

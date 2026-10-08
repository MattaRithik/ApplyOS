import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ effects: [] as (() => void | (() => void))[] }));
vi.mock("react", () => ({
  useEffect: (effect: () => void | (() => void)) => state.effects.push(effect),
  useRef: (current: unknown) => ({ current }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/applications" }));
vi.mock("@/lib/presence/client-status", () => ({ setHeartbeatError: vi.fn(), heartbeatFailure: vi.fn() }));
import { ActivityHeartbeat } from "./activity-heartbeat";

const listeners = new Map<string, (event: Event) => void>();
let cleanups: (() => void)[];
let documentState: { visibilityState: string; hasFocus: () => boolean };
let fetchMock: ReturnType<typeof vi.fn>;
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const latestBody = () => JSON.parse(fetchMock.mock.calls.at(-1)![1].body);
const click = (isTrusted = true) => listeners.get("pointerdown")!({ isTrusted } as Event);

beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-08T16:36:00Z"));
  state.effects = []; listeners.clear(); cleanups = [];
  fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  documentState = { visibilityState: "visible", hasFocus: () => true };
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("document", {
    get visibilityState() { return documentState.visibilityState; }, hasFocus: () => documentState.hasFocus(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  });
  vi.stubGlobal("window", {
    addEventListener: (event: string, callback: (event: Event) => void) => listeners.set(event, callback),
    removeEventListener: vi.fn(), setInterval, clearInterval,
  });
  ActivityHeartbeat({ userId: "dp" });
  for (const effect of state.effects) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
  await flush();
});
afterEach(async () => { for (const cleanup of cleanups) cleanup(); await flush(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("genuine interaction reporting", () => {
  it("does not manufacture activity on mount or from recurring background reports", async () => {
    expect(latestBody().interactionAt).toBeNull();
    documentState.visibilityState = "hidden";
    await vi.advanceTimersByTimeAsync(60000);
    expect(latestBody()).toMatchObject({ interactionAt: null, visible: false });
    expect(fetchMock.mock.calls.every(([, options]) => JSON.parse(options.body).interactionAt === null)).toBe(true);
  });
  it("reports the first real click immediately and keeps its timestamp stable on polls", async () => {
    click(); await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(latestBody()).toMatchObject({ interactionAt: "2026-10-08T16:36:00.000Z", idleSeconds: 0 });
    await vi.advanceTimersByTimeAsync(15000);
    expect(latestBody()).toMatchObject({ interactionAt: "2026-10-08T16:36:00.000Z", idleSeconds: 15 });
  });
  it("ignores synthetic input, background input, and unfocused input", async () => {
    click(false); documentState.visibilityState = "hidden"; click();
    documentState.visibilityState = "visible"; documentState.hasFocus = () => false; click();
    await flush(); await vi.advanceTimersByTimeAsync(15000);
    expect(latestBody().interactionAt).toBeNull();
  });
  it("does not treat mouse movement or focus alone as interaction", async () => {
    expect(listeners.has("pointermove")).toBe(false);
    listeners.get("focus")!({ isTrusted: true } as Event); await flush();
    expect(latestBody().interactionAt).toBeNull();
  });
});

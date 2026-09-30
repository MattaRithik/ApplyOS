import { Readable } from "node:stream";
import { Socket } from "node:net";
import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ record: vi.fn(), createClient: vi.fn() }));
vi.mock("@/lib/presence/heartbeat", () => ({ recordHeartbeat: mocks.record }));
vi.mock("@supabase/ssr", async (original) => ({ ...await original<object>(), createServerClient: mocks.createClient }));
import presence from "@/pages/api/presence";
function request(method = "POST") {
  const socket = new Socket();
  Object.defineProperty(socket, "remoteAddress", { value: "::1" });
  return Object.assign(Readable.from([Buffer.from('{"page":"dashboard"}')]), {
    method, socket, headers: { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json", "x-forwarded-for": "8.8.8.8" },
    cookies: { session: "test-cookie" },
  }) as unknown as NextApiRequest;
}
function response() {
  const res = { setHeader: vi.fn(), getHeader: vi.fn(), status: vi.fn(), send: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as NextApiResponse;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockReturnValue({ auth: {} });
  mocks.record.mockResolvedValue(new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } }));
});
describe("Node heartbeat adapter", () => {
  it("passes the real socket and cookie client while preserving the bounded raw body", async () => {
    const res = response();
    await presence(request(), res);
    expect(mocks.record).toHaveBeenCalledWith(expect.any(Request), "::1", { auth: {} });
    const webRequest = mocks.record.mock.calls[0][0] as Request;
    expect(webRequest.url).toBe("http://localhost:3000/api/presence");
    expect(await webRequest.json()).toEqual({ page: "dashboard" });
    expect(mocks.createClient.mock.calls[0][2].cookies.getAll()).toEqual([{ name: "session", value: "test-cookie" }]);
    expect(res.status).toHaveBeenCalledWith(204);
  });
  it("preserves refreshed authentication cookies", async () => {
    const res = response();
    await presence(request(), res);
    mocks.createClient.mock.calls[0][2].cookies.setAll([{ name: "session", value: "refreshed", options: { path: "/", httpOnly: true } }]);
    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", [expect.stringContaining("session=refreshed")]);
  });
  it("rejects other methods before creating clients or reading data", async () => {
    const res = response();
    await presence(request("GET"), res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });
});

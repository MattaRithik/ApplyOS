import { describe, expect, it, vi } from "vitest";
import { isSameOriginMutation, readJsonBody, safeLocalPath } from "@/lib/security/request";

describe("request security helpers", () => {
  it("rejects cross-site browser mutations", () => {
    const request = new Request("https://applyos.example/api/test", {
      method: "POST",
      headers: { Origin: "https://attacker.example", "Sec-Fetch-Site": "cross-site" },
    });
    expect(isSameOriginMutation(request)).toBe(false);
  });

  it("accepts same-origin mutations", () => {
    const request = new Request("https://applyos.example/api/test", {
      method: "POST",
      headers: { Origin: "https://applyos.example", "Sec-Fetch-Site": "same-origin" },
    });
    expect(isSameOriginMutation(request)).toBe(true);
  });

  it("rejects sibling-site requests even when Origin is missing", () => {
    expect(isSameOriginMutation(new Request("https://applyos.example/api", {
      method: "POST", headers: { "Sec-Fetch-Site": "same-site" },
    }))).toBe(false);
    expect(isSameOriginMutation(new Request("https://applyos.example/api", {
      method: "POST", headers: { Origin: "https://other.applyos.example" },
    }))).toBe(false);
  });

  it("retains support for non-browser clients", () => {
    expect(isSameOriginMutation(new Request("https://applyos.example/api", { method: "POST" }))).toBe(true);
  });

  it("allows only local absolute redirect paths", () => {
    expect(safeLocalPath("/dashboard?tab=usage", "/fallback")).toBe("/dashboard?tab=usage");
    expect(safeLocalPath("//attacker.example", "/fallback")).toBe("/fallback");
    expect(safeLocalPath("https://attacker.example", "/fallback")).toBe("/fallback");
    expect(safeLocalPath("/ok\\@attacker.example", "/fallback")).toBe("/fallback");
    expect(safeLocalPath("javascript:alert(document.cookie)", "/fallback")).toBe("/fallback");
    expect(safeLocalPath("/a/..//attacker.example", "/fallback")).toBe("/fallback");
    expect(safeLocalPath("/a/%2e%2e//attacker.example", "/fallback")).toBe("/fallback");
    expect(safeLocalPath("/\n/attacker.example", "/fallback")).toBe("/fallback");
  });

  it("rejects malformed, wrongly typed, and oversized JSON", async () => {
    const wrongType = await readJsonBody(new Request("https://applyos.example/api", { method: "POST", body: "{}" }));
    expect(wrongType).toMatchObject({ ok: false, status: 415 });

    const malformed = await readJsonBody(
      new Request("https://applyos.example/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad",
      })
    );
    expect(malformed).toMatchObject({ ok: false, status: 400 });

    const oversized = await readJsonBody(
      new Request("https://applyos.example/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "x".repeat(100) }),
      }),
      20
    );
    expect(oversized).toMatchObject({ ok: false, status: 413 });
  });

  it.each([undefined, "1"])("cancels oversized streams with Content-Length %s before EOF", async (length) => {
    const cancel = vi.fn();
    const stream = new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(33)); },
      cancel,
      // Deliberately never closes: reading the whole body would hang.
    });
    const request = new Request("https://applyos.example/api", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(length ? { "Content-Length": length } : {}) },
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect(await readJsonBody(request, 32)).toMatchObject({ ok: false, status: 413 });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("counts UTF-8 bytes and accepts characters split between chunks", async () => {
    const bytes = new TextEncoder().encode('"😀"');
    const request = () => new Request("https://applyos.example/api", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(bytes.slice(0, 3));
          controller.enqueue(bytes.slice(3));
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit);
    expect(await readJsonBody(request(), bytes.length)).toEqual({ ok: true, value: "😀" });
    expect(await readJsonBody(request(), bytes.length - 1)).toMatchObject({ ok: false, status: 413 });
  });

  it("rejects invalid UTF-8 rather than silently replacing it", async () => {
    const request = new Request("https://applyos.example/api", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: new Uint8Array([34, 0xff, 34]),
    });
    expect(await readJsonBody(request)).toMatchObject({ ok: false, status: 400 });
  });
});

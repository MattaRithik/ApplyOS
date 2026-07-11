import { describe, expect, it } from "vitest";
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

  it("allows only local absolute redirect paths", () => {
    expect(safeLocalPath("/dashboard?tab=usage", "/fallback")).toBe("/dashboard?tab=usage");
    expect(safeLocalPath("//attacker.example", "/fallback")).toBe("/fallback");
    expect(safeLocalPath("https://attacker.example", "/fallback")).toBe("/fallback");
    expect(safeLocalPath("/ok\\@attacker.example", "/fallback")).toBe("/fallback");
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
});

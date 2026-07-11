import { describe, expect, it } from "vitest";
import { assertAllowedKeys, httpUrlSchema } from "@/lib/validation/common";

describe("common validation", () => {
  it("rejects non-HTTP URLs", () => {
    expect(httpUrlSchema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(httpUrlSchema.safeParse("https://example.com/path").success).toBe(true);
  });

  it("rejects unknown server-action properties", () => {
    expect(() => assertAllowedKeys({ name: "Allowed" }, ["name"])).not.toThrow();
    expect(() => assertAllowedKeys({ name: "Allowed", user_id: "victim" }, ["name"])).toThrow("Invalid input fields.");
  });
});

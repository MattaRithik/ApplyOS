import { describe, expect, it } from "vitest";
import { parseTargetRoles, needsTargetRolesSetup } from "./target-roles";
import { hashDescription } from "./cache";

describe("target-role preferences", () => {
  it("normalizes separators, whitespace and duplicate role names", () => {
    expect(parseTargetRoles("Risk, Credit Risk; risk\nModel Validation, ")).toEqual(["risk", "Credit Risk", "Model Validation"]);
    expect(parseTargetRoles(null)).toEqual([]);
    expect(parseTargetRoles("")).toEqual([]);
  });
  it("invalidates cached priority when targets change while ignoring order and casing", () => {
    const hash = hashDescription("Job description", undefined, ["Risk", "Credit Risk"]);
    expect(hash).toBe(hashDescription("Job description", undefined, ["credit risk", "Risk"]));
    expect(hash).not.toBe(hashDescription("Job description", undefined, ["Software Engineering"]));
    expect(hash).not.toBe(hashDescription("Job description"));
  });
});


describe("once-only target-role setup", () => {
  it.each([null, "", "   "])("asks when a legacy profile has no roles (%j) and no completion marker", (target_role) => {
    expect(needsTargetRolesSetup({ target_role, settings: {} })).toBe(true);
  });
  it("does not ask again after save, explicit skip or subsequently clearing the roles", () => {
    for (const target_role of ["Risk", "", null]) {
      expect(needsTargetRolesSetup({ target_role, settings: { target_roles_setup_completed: true } })).toBe(false);
    }
  });
  it("respects previously saved nonempty roles", () => {
    expect(needsTargetRolesSetup({ target_role: "Risk" })).toBe(false);
  });
});

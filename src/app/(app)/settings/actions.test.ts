import { beforeEach, expect, it, vi } from "vitest";
const { getUser, ensureProfileMock, update, revalidatePathMock } = vi.hoisted(() => ({ getUser: vi.fn(), ensureProfileMock: vi.fn(), update: vi.fn(), revalidatePathMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser }, from: () => ({ update }) }) }));
vi.mock("@/lib/profiles/ensure-profile", () => ({ ensureProfile: ensureProfileMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
import { updateProfile } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "own-account" } } });
  ensureProfileMock.mockResolvedValue({ data: { settings: { existingPreference: true } }, error: null });
  update.mockImplementation((values) => ({ eq: (_key: string, id: string) => ({ select: () => ({ single: async () => ({ data: { id, ...values }, error: null }) }) }) }));
});
it("saves roles and the lifetime completion flag together, preserving other settings", async () => {
  const saved = await updateProfile({ target_role: " Risk, Credit Risk " });
  expect(saved).toMatchObject({ id: "own-account", target_role: "Risk, Credit Risk", settings: { existingPreference: true, target_roles_setup_completed: true } });
});
it("records an explicit skip so an empty role list does not prompt again", async () => {
  expect(await updateProfile({ target_role: "" })).toMatchObject({ target_role: "", settings: { target_roles_setup_completed: true } });
});
it("does not mark setup complete when only a name is saved", async () => {
  await updateProfile({ full_name: "Test" });
  expect(update).toHaveBeenCalledWith({ full_name: "Test" });
});
it("does not write a profile when unauthenticated", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  await expect(updateProfile({ target_role: "Risk" })).rejects.toThrow("Not authenticated");
  expect(update).not.toHaveBeenCalled();
});

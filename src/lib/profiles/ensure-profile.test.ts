import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
const { upsert, adminClient } = vi.hoisted(() => ({ upsert: vi.fn(), adminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: adminClient }));
import { ensureProfile } from "./ensure-profile";

const user = { id: "authenticated-user", email: "user@example.test", user_metadata: { full_name: "Test" }, app_metadata: {}, aud: "authenticated", created_at: "2026-09-22T00:00:00Z" } satisfies User;
function client(initial: unknown, after: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue(initial);
  const single = vi.fn().mockResolvedValue(after);
  const eq = vi.fn().mockReturnValue({ maybeSingle, single });
  return { db: { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) }) } as unknown as SupabaseClient, eq };
}
beforeEach(() => { vi.clearAllMocks(); adminClient.mockReturnValue({ from: () => ({ upsert }) }); upsert.mockResolvedValue({ error: null }); });
it("repairs a missing profile using the authenticated ID and reads it back under RLS", async () => {
  const restored = { data: { id: user.id, target_role: null }, error: null };
  const { db, eq } = client({ data: null, error: null }, restored);
  expect(await ensureProfile(db, user)).toEqual(restored);
  expect(upsert).toHaveBeenCalledWith({ id: user.id, email: user.email, full_name: "Test" }, { onConflict: "id", ignoreDuplicates: true });
  expect(eq).toHaveBeenCalledWith("id", user.id);
});
it("preserves existing roles and the once-only completion marker", async () => {
  const stored = { data: { target_role: "Risk", settings: { target_roles_setup_completed: true } }, error: null };
  const { db } = client(stored, null);
  expect(await ensureProfile(db, user)).toEqual(stored);
  expect(adminClient).not.toHaveBeenCalled();
});
it("does not mistake a database failure for a missing profile", async () => {
  const failed = { data: null, error: { code: "NETWORK" } };
  const { db } = client(failed, null);
  expect(await ensureProfile(db, user)).toEqual(failed);
  expect(upsert).not.toHaveBeenCalled();
});
it("reports creation failures without claiming the profile was saved", async () => {
  upsert.mockResolvedValueOnce({ error: { code: "FAIL" } });
  const { db } = client({ data: null, error: null }, null);
  expect(await ensureProfile(db, user)).toEqual({ data: null, error: { code: "FAIL" } });
});

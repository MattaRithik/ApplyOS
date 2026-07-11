import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";

const fromMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

// Imported after the mock so the module under test picks up the mocked dependency.
const { requireAuthenticatedUser, requireOwner, isOwner, ensureOwnerBootstrap, getUserRole, getNormalizedOwnerEmail, AdminAuthError } = await import(
  "@/lib/admin/roles"
);

const OWNER_EMAIL = "owner@example.com";

function fakeSupabase(user: Partial<User> | null): SupabaseClient {
  return {
    auth: {
      getUser: async () => ({ data: { user: user as User | null }, error: null }),
    },
  } as unknown as SupabaseClient;
}

function makeUser(overrides: Record<string, unknown> = {}): Partial<User> {
  return {
    id: "user-1",
    email: OWNER_EMAIL,
    email_confirmed_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as Partial<User>;
}

function makeQueryBuilder(finalResult: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.select = vi.fn(self);
  builder.eq = vi.fn(self);
  builder.maybeSingle = vi.fn(async () => finalResult);
  builder.upsert = vi.fn(async () => ({ data: null, error: null }));
  return builder;
}

const originalOwnerEmail = process.env.APP_OWNER_EMAIL;

beforeEach(() => {
  process.env.APP_OWNER_EMAIL = OWNER_EMAIL;
  fromMock.mockReset();
});

afterEach(() => {
  process.env.APP_OWNER_EMAIL = originalOwnerEmail;
});

describe("getNormalizedOwnerEmail", () => {
  it("trims and lowercases", () => {
    process.env.APP_OWNER_EMAIL = "  OWNER@Example.COM  ";
    expect(getNormalizedOwnerEmail()).toBe(OWNER_EMAIL);
  });

  it("returns null when unset", () => {
    delete process.env.APP_OWNER_EMAIL;
    expect(getNormalizedOwnerEmail()).toBeNull();
  });
});

describe("requireAuthenticatedUser", () => {
  it("throws 401 when there is no session", async () => {
    await expect(requireAuthenticatedUser(fakeSupabase(null))).rejects.toMatchObject({ status: 401 });
  });

  it("returns the user when authenticated", async () => {
    const user = makeUser();
    await expect(requireAuthenticatedUser(fakeSupabase(user))).resolves.toMatchObject({ id: "user-1" });
  });
});

describe("ensureOwnerBootstrap", () => {
  it("is a no-op for an account whose email does not match APP_OWNER_EMAIL", async () => {
    await ensureOwnerBootstrap(makeUser({ email: "someone-else@example.com" }) as User);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("is a no-op for an explicitly unverified owner-email account", async () => {
    await ensureOwnerBootstrap(makeUser({ email_confirmed_at: null }) as User);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("grants the owner role and an enabled entitlement on first bootstrap", async () => {
    const roleBuilder = makeQueryBuilder({ data: null });
    const entitlementBuilder = makeQueryBuilder({ data: null });
    fromMock.mockImplementation((table: string) => (table === "app_user_roles" ? roleBuilder : entitlementBuilder));

    await ensureOwnerBootstrap(makeUser() as User);

    expect(roleBuilder.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-1", role: "owner" }));
    expect(entitlementBuilder.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-1", enabled: true }));
  });

  it("does not re-upsert when the owner role is already active", async () => {
    const roleBuilder = makeQueryBuilder({ data: { role: "owner", revoked_at: null } });
    const entitlementBuilder = makeQueryBuilder({ data: { enabled: true, suspended_at: null } });
    fromMock.mockImplementation((table: string) => (table === "app_user_roles" ? roleBuilder : entitlementBuilder));

    await ensureOwnerBootstrap(makeUser() as User);

    expect(roleBuilder.upsert).not.toHaveBeenCalled();
    expect(entitlementBuilder.upsert).not.toHaveBeenCalled();
  });
});

describe("getUserRole", () => {
  it("returns 'user' when there is no role row", async () => {
    fromMock.mockImplementation(() => makeQueryBuilder({ data: null }));
    await expect(getUserRole("user-1")).resolves.toBe("user");
  });

  it("returns 'user' for a revoked role, even if the stored role is 'owner'", async () => {
    fromMock.mockImplementation(() => makeQueryBuilder({ data: { role: "owner", revoked_at: "2026-01-01T00:00:00Z" } }));
    await expect(getUserRole("user-1")).resolves.toBe("user");
  });

  it("returns the stored role when active", async () => {
    fromMock.mockImplementation(() => makeQueryBuilder({ data: { role: "admin", revoked_at: null } }));
    await expect(getUserRole("user-1")).resolves.toBe("admin");
  });
});

describe("requireOwner / isOwner", () => {
  it("throws 401 when unauthenticated", async () => {
    await expect(requireOwner(fakeSupabase(null))).rejects.toMatchObject({ status: 401 });
    await expect(requireOwner(fakeSupabase(null))).rejects.toBeInstanceOf(AdminAuthError);
  });

  it("throws 403 for an authenticated non-owner account, and ignores a client-supplied 'owner' claim", async () => {
    fromMock.mockImplementation(() => makeQueryBuilder({ data: null }));
    // A malicious client can set arbitrary fields on the User object it thinks it's sending,
    // but requireOwner never reads role/email off anything other than the verified session
    // + server-side app_user_roles lookup.
    const spoofedUser = makeUser({ email: "attacker@example.com", role: "owner", user_metadata: { role: "owner" } });
    await expect(requireOwner(fakeSupabase(spoofedUser))).rejects.toMatchObject({ status: 403 });
    await expect(isOwner(fakeSupabase(spoofedUser))).resolves.toBe(false);
  });

  it("resolves for the bootstrapped owner account", async () => {
    const roleBuilder = makeQueryBuilder({ data: { role: "owner", revoked_at: null } });
    const entitlementBuilder = makeQueryBuilder({ data: { enabled: true, suspended_at: null } });
    fromMock.mockImplementation((table: string) => (table === "app_user_roles" ? roleBuilder : entitlementBuilder));

    const user = makeUser();
    await expect(requireOwner(fakeSupabase(user))).resolves.toMatchObject({ id: "user-1" });
    await expect(isOwner(fakeSupabase(user))).resolves.toBe(true);
  });

  it("fails closed (not owner) if the bootstrap/role lookup throws", async () => {
    fromMock.mockImplementation(() => {
      throw new Error("db unavailable");
    });
    await expect(isOwner(fakeSupabase(makeUser()))).resolves.toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
const listAuthUsers = vi.fn();
const empty = { data: [], error: null };
const query = { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), gte: vi.fn().mockResolvedValue(empty),
  then: (resolve: (value: typeof empty) => unknown) => Promise.resolve(empty).then(resolve) };
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: () => ({
  auth: { admin: { listUsers: listAuthUsers } }, from: () => query,
}) }));
const { listUsers, getOverview } = await import("./users");
const users = Array.from({ length: 5 }, (_, i) => ({
  id: `user-${i}`, email: `user${i}@example.com`, created_at: `2026-01-0${i + 1}T00:00:00Z`,
  banned_until: i >= 2 ? "2999-01-01T00:00:00Z" : null,
}));
beforeEach(() => {
  vi.clearAllMocks();
  listAuthUsers.mockResolvedValue({ data: { users }, error: null });
});
describe("admin user counts", () => {
  it("distinguishes two active accounts from three disabled accounts in the list and overview", async () => {
    expect(await listUsers({ page: 0, pageSize: 20 })).toMatchObject({ total: 5, activeUsers: 2, disabledUsers: 3 });
    expect(await getOverview()).toMatchObject({ totalUsers: 5, activeUsers: 2, disabledUsers: 3 });
  });
  it("recounts remaining auth accounts after deletion and moves off an empty last page", async () => {
    listAuthUsers.mockResolvedValue({ data: { users: users.slice(0, 2) }, error: null });
    expect(await listUsers({ page: 1, pageSize: 2 })).toMatchObject({ total: 2, activeUsers: 2, disabledUsers: 0, page: 0, users: expect.any(Array) });
    expect((await listUsers({ page: 1, pageSize: 2 })).users).toHaveLength(2);
    expect(await getOverview()).toMatchObject({ totalUsers: 2, activeUsers: 2, disabledUsers: 0 });
  });
  it("counts filtered users consistently", async () => {
    expect(await listUsers({ search: "user4", page: 0, pageSize: 20 })).toMatchObject({ total: 1, activeUsers: 0, disabledUsers: 1 });
  });
  it("handles deleting the last result", async () => {
    listAuthUsers.mockResolvedValue({ data: { users: [] }, error: null });
    expect(await listUsers({ page: 2, pageSize: 20 })).toMatchObject({ total: 0, activeUsers: 0, disabledUsers: 0, page: 0, users: [] });
  });
});

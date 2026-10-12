import { beforeEach, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: () => ({ rpc }) }));
import { checkMonthlyBudget } from "./budget";
beforeEach(() => {
  vi.resetAllMocks();
});
it("uses an uncapped database aggregate and treats an exhausted budget as blocked", async () => {
  rpc.mockResolvedValue({ data: "15.00", error: null });
  expect(await checkMonthlyBudget("account", 5)).toEqual({ ok: false, spentUsd: 15, limitUsd: 5 });
  expect(rpc).toHaveBeenCalledWith("ai_parser_cost_total", {
    p_user_id: "account",
    p_since: expect.stringMatching(/T00:00:00\.000Z$/),
  });
});
it("accepts zero spending and fails closed on database failure or malformed totals", async () => {
  rpc.mockResolvedValueOnce({ data: 0, error: null });
  expect((await checkMonthlyBudget("account", 5)).ok).toBe(true);
  rpc.mockResolvedValueOnce({ data: null, error: { message: "Unavailable" } });
  expect((await checkMonthlyBudget("account", 5)).ok).toBe(false);
  rpc.mockResolvedValueOnce({ data: "NaN", error: null });
  expect((await checkMonthlyBudget("account", 5)).ok).toBe(false);
});

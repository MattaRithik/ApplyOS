import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { countVisitActivity, withVisitActivity } from "./visit-activity";

const start = "2026-10-07T18:00:00Z";
const middle = "2026-10-07T18:10:00Z";
const end = "2026-10-07T18:20:00Z";
const visit = { user_id: "dp", started_at: start, last_report_at: end };

describe("visit activity summaries", () => {
  it("counts saved application changes and completed parses within each user's window", () => {
    const actions = [
      { user_id: "dp", status: "Application added", recorded_at: start },
      { user_id: "dp", status: "Application updated", recorded_at: middle },
      { user_id: "dp", status: "Application status changed", recorded_at: end },
      { user_id: "dp", status: "Active", recorded_at: middle },
      { user_id: "dp", status: "Application added", recorded_at: "2026-10-07T17:59:59Z" },
      { user_id: "other", status: "Application added", recorded_at: middle },
    ];
    const parses = [
      { user_id: "dp", status: "success", created_at: middle },
      { user_id: "dp", status: "cache_hit", created_at: end },
      { user_id: "dp", status: "failed", created_at: middle },
      { user_id: "dp", status: "success", created_at: "2026-10-07T18:20:01Z" },
      { user_id: "other", status: "success", created_at: middle },
    ];
    expect(countVisitActivity([visit, { ...visit, user_id: "other" }, { ...visit, started_at: "2026-10-07T19:00:00Z", last_report_at: "2026-10-07T19:15:00Z" }], actions, parses))
      .toEqual([{ added: 1, updated: 2, parsed: 2 }, { added: 1, updated: 0, parsed: 1 }, { added: 0, updated: 0, parsed: 0 }]);
  });

  function database(actionResults: { data: unknown[] | null; error: unknown }[]) {
    const actionQuery = { select: vi.fn(), in: vi.fn(), gte: vi.fn(), lte: vi.fn(), order: vi.fn(), range: vi.fn() };
    const parseQuery = { select: vi.fn(), in: vi.fn(), gte: vi.fn(), lte: vi.fn(), order: vi.fn(), range: vi.fn().mockResolvedValue({ data: [], error: null }) };
    for (const query of [actionQuery, parseQuery]) {
      for (const method of [query.select, query.in, query.gte, query.lte, query.order]) method.mockReturnValue(query);
    }
    for (const result of actionResults) actionQuery.range.mockResolvedValueOnce(result);
    const from = vi.fn((table) => table === "user_presence_history" ? actionQuery : parseQuery);
    return { db: { from } as unknown as SupabaseClient, from, actionQuery, parseQuery };
  }

  it("paginates events instead of silently cutting activity off at the database row limit", async () => {
    const action = { user_id: "dp", status: "Application added", recorded_at: middle };
    const { db, actionQuery, parseQuery } = database([
      { data: Array.from({ length: 1000 }, () => action), error: null },
      { data: [action], error: null },
    ]);
    expect((await withVisitActivity(db, [visit]))[0].activity).toEqual({ added: 1001, updated: 0, parsed: 0 });
    expect(actionQuery.range.mock.calls).toEqual([[0, 999], [1000, 1999]]);
    expect(actionQuery.in).toHaveBeenCalledWith("user_id", ["dp"]);
    expect(actionQuery.gte).toHaveBeenCalledWith("recorded_at", "2026-10-07T18:00:00.000Z");
    expect(actionQuery.lte).toHaveBeenCalledWith("recorded_at", "2026-10-07T18:20:00.000Z");
    expect(actionQuery.select).toHaveBeenCalledWith("user_id, status, recorded_at");
    expect(parseQuery.select).toHaveBeenCalledWith("user_id, status, created_at");
    expect(parseQuery.in).toHaveBeenCalledWith("status", ["success", "cache_hit"]);
  });

  it("does not report zero activity when records cannot be read", async () => {
    const { db } = database([{ data: null, error: { message: "Unavailable" } }]);
    await expect(withVisitActivity(db, [visit])).rejects.toThrow("Unable to load visit actions.");
  });

  it("does not query unrelated users when there are no visits", async () => {
    const { db, from } = database([]);
    expect(await withVisitActivity(db, [])).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });
});

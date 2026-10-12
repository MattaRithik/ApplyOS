import { expect, it, vi } from "vitest";
import { readAllRows } from "./pagination";

it("reads beyond the database row limit without dropping the final page", async () => {
  const all = Array.from({ length: 1201 }, (_, id) => ({ id }));
  const range = vi.fn(async (from: number, to: number) => ({
    data: all.slice(from, to + 1),
    error: null,
  }));
  expect(await readAllRows({ range })).toEqual(all);
  expect(range.mock.calls).toEqual([
    [0, 499],
    [500, 999],
    [1000, 1499],
  ]);
});
it("fails if a later page cannot be read instead of returning an incomplete export", async () => {
  const range = vi
    .fn()
    .mockResolvedValueOnce({ data: Array(500).fill({ id: 1 }), error: null })
    .mockResolvedValueOnce({ data: null, error: { message: "Unavailable" } });
  await expect(readAllRows({ range })).rejects.toThrow("Could not read all records");
});

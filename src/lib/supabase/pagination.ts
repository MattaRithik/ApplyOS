import "server-only";

interface PagedQuery<T> {
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: unknown }>;
}

/** The caller supplies stable ordering and ownership filters on every page. */
export async function readAllRows<T>(query: PagedQuery<T>): Promise<T[]> {
  const pageSize = 500;
  const rows: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error || data === null) throw new Error("Could not read all records. Please try again.");
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

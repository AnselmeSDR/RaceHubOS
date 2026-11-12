/** Ascending best lap, entities without one last. */
export const byBestLap = (a, b) => (a.bestLap || Infinity) - (b.bestLap || Infinity);

/** Ascending `key`. */
export const byNumber = (key) => (a, b) => a[key] - b[key];

/**
 * A page of `model` rows for a list query (`deleted`, `limit`, `offset`, `sortBy`, `sortOrder`).
 * Rows sort on a column, on a relation count (`counts`), or in memory with one of the `computed`
 * ascending comparators — which reads every row before cutting the page. `where` narrows the rows;
 * `shape` completes each row read (computed values the comparators sort on).
 *
 * @returns {{ page: object[], total: number, hasMore: boolean }}
 */
export async function listPage(
  model,
  query,
  { sortBy: defaultSort, include, counts, computed = {}, where: filter = {}, shape = (row) => row }
) {
  const { deleted, limit = '50', offset = '0', sortBy = defaultSort, sortOrder = 'asc' } = query;
  const where = { ...filter, deletedAt: deleted === 'true' ? { not: null } : null };
  const start = parseInt(offset);
  const size = parseInt(limit);
  const compare = Object.hasOwn(computed, sortBy) ? computed[sortBy] : null;
  const orderBy = counts.includes(sortBy) ? { [sortBy]: { _count: sortOrder } } : { [sortBy]: sortOrder };

  const [rows, total] = await Promise.all([
    model.findMany({ where, include, ...(compare ? {} : { orderBy, skip: start, take: size }) }),
    model.count({ where }),
  ]);
  const direction = sortOrder === 'asc' ? 1 : -1;
  const shaped = rows.map(shape);
  const page = compare ? shaped.sort((a, b) => direction * compare(a, b)).slice(start, start + size) : shaped;
  return { page, total, hasMore: start + size < total };
}

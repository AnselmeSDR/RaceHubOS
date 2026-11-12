/** Controllers on a Control Unit: the most drivers one session can take. */
export const MAX_SESSION_DRIVERS = 6;

const noCar = () => null;

/**
 * How many groups `items` need: at most `maxPerGroup` in each, and at least as many as the items
 * sharing one car (`carOf`), so that they can all run apart.
 */
export function groupCount(items, maxPerGroup, carOf = noCar) {
  const sharing = new Map();
  for (const item of items) {
    const car = carOf(item);
    if (car != null) sharing.set(car, (sharing.get(car) ?? 0) + 1);
  }
  return Math.max(Math.ceil(items.length / maxPerGroup), ...sharing.values());
}

/** `items` dealt like cards into `count` groups (none: no group), two items of the same car (`carOf`) apart. */
export function dealGroups(items, count, carOf = noCar) {
  if (!count) return [];
  const groups = Array.from({ length: count }, () => []);
  items.forEach((item, i) => groups[i % count].push(item));
  return separateCars(groups, carOf);
}

/**
 * Round-robin groups, as few as `groupCount` allows, two items of the same car apart:
 * 10 items, max 4 → [0,3,6,9] [1,4,7] [2,5,8].
 */
export const distributeEvenly = (items, maxPerGroup, carOf = noCar) =>
  dealGroups(items, groupCount(items, maxPerGroup, carOf), carOf);

/**
 * Balanced consecutive groups, order kept as far as cars allow: 10 items, max 6 → 5 + 5 rather
 * than 6 + 4.
 */
export function distributeSequential(items, maxPerGroup, carOf = noCar) {
  const count = groupCount(items, maxPerGroup, carOf);
  const base = Math.floor(items.length / count);
  const extra = items.length % count;
  const groups = [];
  let offset = 0;
  for (let g = 0; g < count; g++) {
    const size = base + (g < extra ? 1 : 0);
    groups.push(items.slice(offset, offset + size));
    offset += size;
  }
  return separateCars(groups, carOf);
}

/** Whether `item`'s car already runs in `group`, `except` aside (no car never clashes). */
export function carTaken(group, item, carOf, except) {
  const car = carOf(item);
  return car != null && group.some((other) => other !== item && other !== except && carOf(other) === car);
}

/**
 * Moves drivers so that no group has the same car twice: the last of a clash is swapped with the
 * nearest group that can take it, nearest neighbour in order first, so a ranking slice stays close
 * to itself. Group sizes never change; a clash nobody can take stays.
 */
export function separateCars(groups, carOf) {
  const result = groups.map((group) => [...group]);
  for (let g = 0; g < result.length; g++) {
    for (let i = result[g].length - 1; i >= 0; i--) {
      const item = result[g][i];
      if (!carTaken(result[g], item, carOf)) continue;
      const swap = nearestSwap(result, g, item, carOf);
      if (!swap) continue;
      const [h, j] = swap;
      result[g][i] = result[h][j];
      result[h][j] = item;
    }
  }
  return result;
}

function nearestSwap(groups, g, item, carOf) {
  for (let distance = 1; distance < groups.length; distance++) {
    for (const h of [g + distance, g - distance]) {
      const other = groups[h];
      if (!other) continue;
      // After the group: its first drivers are the nearest; before it, its last ones
      const indexes = other.map((_, j) => j);
      if (h < g) indexes.reverse();
      for (const j of indexes) {
        const candidate = other[j];
        if (!carTaken(groups[g], candidate, carOf, item) && !carTaken(other, item, carOf, candidate)) return [h, j];
      }
    }
  }
  return null;
}

/** What a record shows of each side. */
const SIDES = {
  driver: { select: { id: true, name: true, color: true, img: true } },
  car: { select: { id: true, brand: true, model: true, color: true, img: true } },
  track: { select: { id: true, name: true, color: true } },
};

/**
 * The ten best laps of a driver, car or track (`owner`), one per pairing of the other two sides —
 * a driver's best with each car on each track — fastest first.
 */
export async function bestLapRecords(prisma, owner, id) {
  const others = Object.keys(SIDES).filter((side) => side !== owner);
  const laps = await prisma.lap.findMany({
    where: { [`${owner}Id`]: id },
    orderBy: { lapTime: 'asc' },
    distinct: others.map((side) => `${side}Id`),
    take: 10,
    include: { ...Object.fromEntries(others.map((side) => [side, SIDES[side]])), session: { select: { type: true } } },
  });
  return laps.map((lap) => ({
    id: lap.id,
    lapTime: lap.lapTime,
    ...Object.fromEntries(others.map((side) => [side, lap[side]])),
    sessionType: lap.session.type,
  }));
}

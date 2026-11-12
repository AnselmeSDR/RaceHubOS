import { carLabel } from './labels.js';
import { emptyRecord, tallyEntry } from './record.js';
import { divisionsOf } from '../divisions.js';

/**
 * Statistiques calculées sur le périmètre exporté : « trois victoires » n'a pas
 * le même sens selon qu'on exporte une session ou un championnat, ce qui est
 * compté ici, c'est ce que le classeur contient.
 */

const blankStats = () => ({ ...emptyRecord(), lapCount: 0, lapTimeSum: 0 });
const NO_STATS = blankStats();

export const driverKey = (row) => row.driverId ?? row.driver?.id;
export const carKey = (row) => row.carId ?? row.car?.id;

/** Records per `keyOf` (a driver or a car), from the entries and laps of `sessions`. */
export function statsBy(sessions, keyOf) {
  const stats = new Map();
  const of = (key) => {
    if (!stats.has(key)) stats.set(key, blankStats());
    return stats.get(key);
  };

  for (const session of sessions) {
    for (const entry of session.drivers ?? []) {
      const key = keyOf(entry);
      if (key) tallyEntry(of(key), entry, session);
    }

    for (const lap of session.laps ?? []) {
      const key = keyOf(lap);
      if (!key || !lap.lapTime) continue;

      const stat = of(key);
      stat.lapCount += 1;
      stat.lapTimeSum += lap.lapTime;
      if (stat.bestLap == null || lap.lapTime < stat.bestLap) stat.bestLap = lap.lapTime;
    }
  }
  return stats;
}

/** Reads an item's stats in `stats`, blank when it has none. */
export const statOf = (stats) => (item) => stats.get(item.id) ?? NO_STATS;

export const averageLap = (stat) => (stat.lapCount ? stat.lapTimeSum / stat.lapCount : null);

/** Every driver, car, track, driver division and car category the given sessions actually used. */
export function referencesOf(sessions) {
  const byId = (items) => [...new Map(items.filter(Boolean).map((i) => [i.id, i])).values()];
  const entries = sessions.flatMap((s) => s.drivers ?? []);

  const drivers = byId(entries.map((e) => e.driver));
  const cars = byId(entries.map((e) => e.car));
  return {
    drivers,
    cars,
    tracks: byId(sessions.map((s) => s.track)),
    divisions: byId(drivers.flatMap(divisionsOf)),
    categories: byId(cars.flatMap(divisionsOf)),
  };
}

/** Meilleur tour de chaque circuit sur le périmètre, et qui l'a signé. */
export function trackBests(sessions) {
  const bests = new Map();

  for (const session of sessions) {
    const trackId = session.trackId ?? session.track?.id;
    if (!trackId) continue;

    if (!bests.has(trackId)) bests.set(trackId, { sessions: 0, laps: 0, lapTime: null, driver: null, car: null });
    const best = bests.get(trackId);
    best.sessions += 1;

    for (const lap of session.laps ?? []) {
      if (!lap.lapTime) continue;
      best.laps += 1;
      if (best.lapTime == null || lap.lapTime < best.lapTime) {
        best.lapTime = lap.lapTime;
        best.driver = lap.driver?.name ?? null;
        best.car = carLabel(lap.car);
      }
    }
  }
  return bests;
}

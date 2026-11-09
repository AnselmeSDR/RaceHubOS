import { withImageUrl } from '../../utils/imageUrl.js';

/** The driver with the most entries (each driver loaded with the entries counted), the first on a tie. */
export function mostEntries(drivers) {
  const top = drivers.reduce((max, driver) => {
    const count = driver.sessions.length;
    return count > (max?.count || 0) ? { driver, count } : max;
  }, null);
  return top && { driver: withImageUrl(top.driver), count: top.count };
}

/** The fastest lap as a record: time, driver, car, track and date (lap loaded with its session's track). */
export const lapRecord = (lap) =>
  lap && {
    time: lap.lapTime,
    driver: withImageUrl(lap.driver),
    car: withImageUrl(lap.car),
    track: withImageUrl(lap.session.track),
    date: lap.timestamp,
  };

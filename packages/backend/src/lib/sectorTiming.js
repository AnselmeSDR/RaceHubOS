// CU channel 1 is the finish line, 2/3 are intermediate measuring points.
// Only complete, ordered crossings between two finish passages form sectors.
export class SectorTiming {
  constructor() {
    this.reset();
  }
  reset() {
    this.cars = new Map();
  }
  push({ controller, timestamp, sector }) {
    if (
      !Number.isInteger(controller) ||
      controller < 0 ||
      controller > 5 ||
      !Number.isFinite(timestamp) ||
      timestamp <= 0 ||
      ![1, 2, 3].includes(sector)
    )
      return null;
    let state = this.cars.get(controller);
    if (sector === 1) {
      let result = null;
      if (state && !state.invalid && timestamp > state.last && state.points[2]) {
        const first = state.points[2] - state.start;
        const second = (state.points[3] || timestamp) - state.points[2];
        result = {
          sector1: first,
          sector2: second,
          sector3: state.points[3] ? timestamp - state.points[3] : null,
          completed: true,
        };
      }
      this.cars.set(controller, { start: timestamp, last: timestamp, points: {}, invalid: false });
      return result;
    }
    if (!state) return null;
    if (timestamp <= state.last || state.points[sector] || (sector === 3 && !state.points[2])) {
      state.invalid = true;
      return null;
    }
    state.last = timestamp;
    state.points[sector] = timestamp;
    if (state.invalid) return null;
    return {
      sector1: state.points[2] - state.start,
      sector2: state.points[3] ? state.points[3] - state.points[2] : null,
      sector3: null,
      completed: false,
    };
  }
}

/**
 * The Control Unit has 10 levels for speed, brake and fuel alike (manual 30352, "Setting of the
 * cars' basic speed": 1-10); the protocol carries a nibble, which is the field size, not the scale.
 * A car's settings are 0-100.
 */
const toLevel = (value) => Math.max(1, Math.min(10, Math.round((value ?? 100) / 10)));

/** The factory settings, for a controller without a car. */
export const FACTORY_SETTINGS = Object.freeze({ speed: 10, brake: 10, fuel: 7 });

/** The CU levels of a car's settings, or the factory ones without a car. */
export function cuSettingsOf(car) {
  if (!car) return FACTORY_SETTINGS;
  return { speed: toLevel(car.maxSpeed), brake: toLevel(car.brakeForce), fuel: toLevel(car.fuelCapacity) };
}

/**
 * The equipment and measurements of a car, beyond brand and model.
 *
 * Free text rather than closed lists: parts change too often to freeze an enum,
 * and an incomplete list stops the user from writing what is actually mounted.
 */
export const CAR_TEXT_SPECS = Object.freeze([
  'scale', 'chassis', 'motor', 'gearRatio',
  'tyresFront', 'tyresRear', 'guide', 'braids', 'magnet', 'notes',
]);

/** Measurements: grams for the weight, millimetres for the rest. */
export const CAR_NUMBER_SPECS = Object.freeze([
  'weightGrams', 'lengthMm', 'widthMm', 'wheelbaseMm',
  'frontTrackMm', 'rearTrackMm', 'groundClearanceMm',
]);

export const CAR_SPECS = Object.freeze([...CAR_TEXT_SPECS, ...CAR_NUMBER_SPECS]);

const INTEGER_SPECS = new Set(['weightGrams']);

/**
 * Picks the spec fields out of a request body.
 *
 * An empty field means "not filled in", so it is stored as null rather than as
 * an empty string — otherwise the card shows a blank line instead of nothing.
 */
export function carSpecsFrom(body = {}, { partial = false } = {}) {
  const data = {};

  for (const field of CAR_TEXT_SPECS) {
    if (partial && body[field] === undefined) continue;
    const value = typeof body[field] === 'string' ? body[field].trim() : body[field];
    data[field] = value || null;
  }

  for (const field of CAR_NUMBER_SPECS) {
    if (partial && body[field] === undefined) continue;
    const raw = body[field];
    if (raw === null || raw === undefined || raw === '') {
      data[field] = null;
      continue;
    }
    const parsed = INTEGER_SPECS.has(field) ? parseInt(raw, 10) : parseFloat(raw);
    data[field] = Number.isFinite(parsed) ? parsed : null;
  }

  return data;
}

/** What a division classes: drivers (GOLD, SILVER…) or cars, then called a category (GT3, DTM…). */
export const DivisionScope = Object.freeze({
  DRIVER: 'driver',
  CAR: 'car',
});

export const DIVISION_SCOPES = Object.freeze(Object.values(DivisionScope));

export function isDivisionScope(value) {
  return DIVISION_SCOPES.includes(value);
}

/** The `divisionId` filter value for the records in no division. */
export const NO_DIVISION = 'none';

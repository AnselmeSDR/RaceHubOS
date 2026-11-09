/** The laps table's filters: nothing selected, the best lap per driver and car only. */
export const EMPTY_LAP_FILTERS = {
  driverId: [],
  carId: [],
  trackId: [],
  championshipId: [],
  sessionType: [],
  unique: true,
}

const LIST_FILTERS = ['driverId', 'carId', 'trackId', 'championshipId', 'sessionType']

/** The query parameters of the laps endpoint for `filters`. */
export function lapFilterParams(filters) {
  const params = {}
  for (const key of LIST_FILTERS) if (filters[key].length) params[key] = filters[key].join(',')
  params.unique = String(filters.unique)
  return params
}

/** Whether a column filter narrows the list. */
export const hasLapFilters = (filters) => LIST_FILTERS.some((key) => filters[key].length > 0)

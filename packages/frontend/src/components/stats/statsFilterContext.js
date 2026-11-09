import { createContext } from 'react'

/**
 * The laps table's filters, for its column headers: `filters` (the selected values of each filter),
 * `setFilter(key, values)` and `options` (the choices of each filter).
 */
export const StatsFilterContext = createContext({ filters: {}, setFilter: () => {}, options: {} })

import { createContext } from 'react'

/**
 * A table's column filters, for its column headers: `filters` (the selected values of each filter),
 * `setFilter(key, values)` and `options` (the choices of each filter).
 */
export const ColumnFilterContext = createContext({ filters: {}, setFilter: () => {}, options: {} })

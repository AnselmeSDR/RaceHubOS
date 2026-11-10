/**
 * The query parameters of a list for its column `filters`: each selection joined with commas (none
 * sent when empty), each yes/no option as "true" or "false".
 */
export function filterParams(filters) {
  const params = {}
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      if (value.length) params[key] = value.join(',')
    } else params[key] = String(value)
  }
  return params
}

/** Whether a column filter narrows the list (yes/no options don't count). */
export const hasColumnFilters = (filters) => Object.values(filters).some((v) => Array.isArray(v) && v.length > 0)

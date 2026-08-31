import { SESSION_TYPES, sessionTypeFullKey, sessionTypeKey } from '@racehubos/shared'

/**
 * Session-type options for filters and selects.
 *
 * Every list of types used to be written by hand, which is how "balancing"
 * ended up in the database long before it appeared in the statistics filter.
 * Adding a type to @racehubos/shared is now enough for it to show up here.
 */
export function sessionTypeOptions(t, { short = false } = {}) {
  return SESSION_TYPES.map((value) => ({
    value,
    label: t(short ? sessionTypeKey(value) : sessionTypeFullKey(value)),
  }))
}

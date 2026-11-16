/**
 * A ref that gives a field its own validity: `message` while it is wrong, shown on the field when the
 * step is checked; nothing when right.
 */
export const validity = (message) => (field) => field?.setCustomValidity(message || '')

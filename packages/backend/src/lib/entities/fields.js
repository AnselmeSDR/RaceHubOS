/** Field readers: the value as sent, trimmed, or null when empty. */
export const kept = (value) => value;
export const trimmed = (value) => value.trim();
export const orNull = (value) => value || null;
export const trimmedOrNull = (value) => value?.trim() || null;

/** The update data for the `fields` present in `body`, each read by its reader. */
export function changesFrom(body, fields) {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([key]) => body[key] !== undefined)
      .map(([key, read]) => [key, read(body[key])])
  );
}

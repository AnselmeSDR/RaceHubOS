/**
 * The session types, in one place.
 *
 * Every list of types used to be written by hand: the filters, the standings,
 * the labels, the tests. Adding "balancing" meant hunting for the ones that had
 * been missed — which is why it was in the database long before it appeared in
 * the statistics filter. Anything that enumerates session types reads it here.
 *
 * The values are the ones stored in `Session.type`, so they are also the enum
 * declared in schema.prisma. Changing one means a migration.
 */

export const SessionType = Object.freeze({
  PRACTICE: 'practice',
  QUALIF: 'qualif',
  RACE: 'race',
  BALANCING: 'balancing',
});

/** Every type, in the order they should be offered to the user. */
export const SESSION_TYPES = Object.freeze(Object.values(SessionType));

/**
 * The types offered when setting up a race — a championship session, a free
 * session, a standings tab. Balancing stands apart: it has its own screen, it
 * belongs to no championship and it produces no standings, so it never appears
 * in these lists even though it is a session type like the others.
 */
export const STANDARD_SESSION_TYPES = Object.freeze([
  SessionType.PRACTICE,
  SessionType.QUALIF,
  SessionType.RACE,
]);

export function isSessionType(value) {
  return SESSION_TYPES.includes(value);
}

/** i18n key holding this type's short label, e.g. "Qualif". */
export function sessionTypeKey(type) {
  return `glossary:sessionType.${type}`;
}

/** i18n key holding this type's full label, e.g. "Qualifications". */
export function sessionTypeFullKey(type) {
  return `glossary:sessionTypeFull.${type}`;
}

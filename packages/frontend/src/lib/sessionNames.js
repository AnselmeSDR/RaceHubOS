import i18n from '../i18n'
import { SessionType, sessionTypeFullKey, sessionTypeKey } from '@racehubos/shared'

/**
 * Names for the sessions the server creates on its own (championship practice,
 * auto-generated qualifs and races, free sessions), in the interface language.
 * Qualifs and races get their number appended by the server.
 */
export function sessionNames() {
  return {
    [SessionType.PRACTICE]: i18n.t(sessionTypeFullKey(SessionType.PRACTICE)),
    [SessionType.QUALIF]: i18n.t(sessionTypeKey(SessionType.QUALIF)),
    [SessionType.RACE]: i18n.t(sessionTypeKey(SessionType.RACE)),
    [SessionType.BALANCING]: i18n.t(sessionTypeFullKey(SessionType.BALANCING)),
  }
}

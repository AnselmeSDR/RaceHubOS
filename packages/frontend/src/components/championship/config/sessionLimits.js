import { Clock, Flag } from 'lucide-react'
import { SessionType } from '@racehubos/shared'

// The two kinds of session a championship schedules besides its free practice
export const SESSION_TYPE_STYLE = {
  [SessionType.QUALIF]: {
    labelKey: 'configModal.sessionTypes.qualif',
    prefix: 'Q',
    color: 'bg-blue-500/15 text-blue-600',
    icon: Clock,
  },
  [SessionType.RACE]: {
    labelKey: 'configModal.sessionTypes.race',
    prefix: 'R',
    color: 'bg-green-500/15 text-green-600',
    icon: Flag,
  },
}

export const NEW_SESSION_FORM = { name: '', duration: 5, maxLaps: 10, useTime: true, useLaps: false }

// The editable form of a session: its limits, or the defaults of a new one
export const sessionFormOf = (session) => ({
  name: session.name || '',
  duration: session.maxDuration ? Math.round(session.maxDuration / 60000) : 5,
  maxLaps: session.maxLaps || 10,
  useTime: !!session.maxDuration,
  useLaps: !!session.maxLaps,
})

export const limitsBody = (form) => ({
  maxDuration: form.useTime ? form.duration * 60000 : null,
  maxLaps: form.useLaps ? form.maxLaps : null,
})

// Qualifying sessions and races in their running order, the oldest first on a tie
export const qualifRaceSessions = (sessions) =>
  sessions
    .filter((s) => s.type === SessionType.QUALIF || s.type === SessionType.RACE)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || new Date(a.createdAt) - new Date(b.createdAt))

// Q1, Q2… R1, R2…: the rank of a session among those of its type
export function sessionLabel(session, scheduled) {
  const sameType = scheduled.filter((s) => s.type === session.type)
  return `${SESSION_TYPE_STYLE[session.type].prefix}${sameType.findIndex((s) => s.id === session.id) + 1}`
}

export const nextSessionLabel = (type, scheduled) =>
  `${SESSION_TYPE_STYLE[type].prefix}${scheduled.filter((s) => s.type === type).length + 1}`

export function limitsText(session) {
  const minutes = session.maxDuration ? `${Math.round(session.maxDuration / 60000)}min` : ''
  const laps = session.maxLaps ? `${session.maxLaps}t` : ''
  return [minutes, laps].filter(Boolean).join(' / ')
}

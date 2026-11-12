import { Clock, Flag, FlaskConical } from 'lucide-react'
import { SessionType, sessionTypeAbbrKey, sessionTypeFullKey } from '@racehubos/shared'
import { SESSION_COLORS } from '@/lib/colors'

// The kinds of session a championship schedules, each as many times as wanted
export const SESSION_TYPE_STYLE = {
  [SessionType.PRACTICE]: {
    labelKey: sessionTypeFullKey(SessionType.PRACTICE),
    color: `${SESSION_COLORS.practice.bg} ${SESSION_COLORS.practice.text}`,
    icon: FlaskConical,
  },
  [SessionType.QUALIF]: {
    labelKey: 'configModal.sessionTypes.qualif',
    color: 'bg-blue-500/15 text-blue-600',
    icon: Clock,
  },
  [SessionType.RACE]: {
    labelKey: 'configModal.sessionTypes.race',
    color: 'bg-green-500/15 text-green-600',
    icon: Flag,
  },
}

// A free practice may run without limits; qualifying and races need a time or a lap count
export const needsLimit = (type) => type !== SessionType.PRACTICE

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

// Free practices, qualifying sessions and races in their running order, the oldest first on a tie
export const scheduledSessions = (sessions) =>
  sessions
    .filter((s) => SESSION_TYPE_STYLE[s.type])
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || new Date(a.createdAt) - new Date(b.createdAt))

// FP1, Q1, Q2… R1: the type's abbreviation and the rank of the session among those of its type
export function sessionLabel(session, scheduled, t) {
  const sameType = scheduled.filter((s) => s.type === session.type)
  return `${t(sessionTypeAbbrKey(session.type))}${sameType.findIndex((s) => s.id === session.id) + 1}`
}

export const nextSessionLabel = (type, scheduled, t) =>
  `${t(sessionTypeAbbrKey(type))}${scheduled.filter((s) => s.type === type).length + 1}`

export function limitsText(session) {
  const minutes = session.maxDuration ? `${Math.round(session.maxDuration / 60000)}min` : ''
  const laps = session.maxLaps ? `${session.maxLaps}t` : ''
  return [minutes, laps].filter(Boolean).join(' / ')
}

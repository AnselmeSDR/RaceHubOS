import { SessionType } from '@racehubos/shared'
import i18n from '@/i18n'

const PODIUM_DELAY_MS = 3000
const BETWEEN_LINES_MS = 500
const RANKS = ['first', 'second', 'third']

/** The three best drivers who drove: by best lap in qualifying, by laps then total time otherwise. */
export function podiumOf(leaderboard, sessionType) {
  const isQualif = sessionType === SessionType.QUALIF
  return leaderboard
    .filter((d) => d.driver && (d.totalLaps > 0 || d.bestLapTime))
    .sort((a, b) => {
      if (isQualif) return (a.bestLapTime || Infinity) - (b.bestLapTime || Infinity)
      if ((b.totalLaps || 0) !== (a.totalLaps || 0)) return (b.totalLaps || 0) - (a.totalLaps || 0)
      return (a.totalTime || Infinity) - (b.totalTime || Infinity)
    })
    .slice(0, 3)
}

/** What the podium announcement says, third place first. */
export function podiumLines(leaderboard, sessionType, formatTime) {
  const isQualif = sessionType === SessionType.QUALIF
  return podiumOf(leaderboard, sessionType)
    .map((entry, i) =>
      i18n.t('voice:podium', {
        rank: i18n.t(`voice:ranks.${RANKS[i]}`),
        name: entry.driver.name,
        time: formatTime(isQualif ? entry.bestLapTime : entry.totalTime),
      })
    )
    .reverse()
}

/** The finish music, then — if enabled — the podium, one line after the other. */
export function announceFinish(voice, { leaderboard, sessionType }) {
  try {
    const audio = new Audio('/sounds/race-finish.mp3')
    audio.volume = 0.7
    audio.play().catch(() => {})
  } catch {
    // No audio: the podium is still announced
  }
  if (!voice.podiumEnabledRef.current || !leaderboard?.length) return
  const lines = podiumLines(leaderboard, sessionType, voice.formatTimeVoice)
  const speakFrom = (index) => {
    if (index >= lines.length) return
    const utterance = voice.speak(lines[index], { rate: 1.0, force: true })
    if (utterance) utterance.onend = () => setTimeout(() => speakFrom(index + 1), BETWEEN_LINES_MS)
  }
  setTimeout(() => speakFrom(0), PODIUM_DELAY_MS)
}

/** What a new best lap announces, null when announcements are off or too few laps are done. */
export function bestLapLine(voice, data) {
  if (!voice.bestLapEnabledRef.current || data.maxLapsCompleted < voice.minLapsRef.current) return null
  const name =
    data.driverName ||
    [data.carBrand, data.carModel].filter(Boolean).join(' ') ||
    i18n.t('voice:car', { number: data.controller + 1 })
  return i18n.t('voice:bestLap', { name, time: voice.formatTimeVoice(data.lapTime) })
}

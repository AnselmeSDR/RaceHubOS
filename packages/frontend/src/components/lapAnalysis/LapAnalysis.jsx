import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SessionType } from '@racehubos/shared'
import DriverAvatar from '@/components/driver/DriverAvatar'
import Segmented from '@/components/settings/Segmented'
import { Card, CardContent } from '@/components/ui/card'
import { useApp } from '@/context/AppContext'
import { CARD, driverColor, readableOn } from '@/lib/colors'
import LapLines from './LapLines'
import LapSpread from './LapSpread'
import { MIN_LAPS, PACE_WINDOW, analysedLaps } from './lapStats'

const VIEW_KEY = 'racehubos-lap-analysis'
const UNKNOWN_DRIVER_COLOR = '#6B7280'
// Gaps only mean something when the laps are driven together
const viewsOf = (sessionType) => (sessionType === SessionType.RACE ? ['pace', 'gaps', 'spread'] : ['pace', 'spread'])

/**
 * The laps of a session under its leaderboard, from two laps on: the pace of each driver over their
 * clean laps, the gaps to the leader of a race, or how consistent each one was. The view picked is
 * remembered; a driver is hidden from the lines by their legend. `entries` are those of the
 * leaderboard, each with its `laps`. None for balancing, which has its own chart.
 */
export default function LapAnalysis({ entries, sessionType }) {
  const { t } = useTranslation('race')
  const { isDark } = useApp()
  const [picked, setPicked] = useState(() => localStorage.getItem(VIEW_KEY))
  const [hidden, setHidden] = useState(() => new Set())
  const [focus, setFocus] = useState(null)
  const drivers = useMemo(
    () =>
      analysedLaps(entries).map((driver) => {
        const code = driver.driver?.name?.split(' ').pop() || `#${driver.controller + 1}`
        const face = driver.driver ?? { name: code, color: UNKNOWN_DRIVER_COLOR }
        // The driver's colour, pulled away from the card when it would not read on it
        return { ...driver, code, face, ink: readableOn(driverColor(face), CARD[isDark ? 'dark' : 'light']) }
      }),
    [entries, isDark]
  )

  if (sessionType === SessionType.BALANCING) return null
  if (!drivers.some((driver) => driver.times.length >= MIN_LAPS)) return null

  const views = viewsOf(sessionType)
  const view = views.includes(picked) ? picked : views[0]
  const shown = drivers.filter((driver) => !hidden.has(driver.key))
  const fastest = Math.min(...drivers.map((driver) => driver.best))

  function pick(next) {
    setPicked(next)
    localStorage.setItem(VIEW_KEY, next)
  }

  // The last driver in sight stays
  function toggle(key) {
    if (!hidden.has(key) && shown.length === 1) return
    const next = new Set(hidden)
    if (!next.delete(key)) next.add(key)
    setHidden(next)
    setFocus(null)
  }

  return (
    <Card data-testid="lap-analysis">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">{t('analysis.title')}</h3>
          <p className="text-xs text-muted-foreground">{t(`analysis.what.${view}`, { count: PACE_WINDOW })}</p>
          <div className="ml-auto">
            <Segmented
              label={t('analysis.title')}
              value={view}
              onChange={pick}
              options={views.map((value) => ({ value, label: t(`analysis.views.${value}`) }))}
            />
          </div>
        </div>
        {view === 'spread' ? (
          <LapSpread drivers={drivers} fastest={fastest} />
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 px-4 pt-3">
              {drivers.map((driver) => {
                const on = !hidden.has(driver.key)
                return (
                  <button
                    key={driver.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(driver.key)}
                    onMouseEnter={() => on && setFocus(driver.key)}
                    onMouseLeave={() => setFocus(null)}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-md bg-muted/60 px-1.5 text-xs font-bold transition-opacity ${on ? '' : 'opacity-40'}`}
                  >
                    <span aria-hidden="true" className="flex">
                      <DriverAvatar driver={driver.face} className="size-5" />
                    </span>
                    {driver.code}
                    <span className="h-[3px] w-3.5 rounded-full" style={{ backgroundColor: driver.ink }} />
                  </button>
                )
              })}
            </div>
            <div className="px-2 pb-2">
              <LapLines
                view={view}
                drivers={shown}
                leader={drivers[0]}
                fastest={fastest}
                focus={focus}
                onFocus={setFocus}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

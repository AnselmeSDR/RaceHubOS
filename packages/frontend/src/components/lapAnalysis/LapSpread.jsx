import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import DriverAvatar from '@/components/driver/DriverAvatar'
import { GOLD, GRID_HEAD, GRID_LIST, GRID_ROW } from '@/lib/gridList'

// The marks of the scale, every half second (ms), every second when the laps are spread wide
const STEP = 500
const WIDE = 4000
// How far a lap sits from the middle of its line (px), so that close laps do not hide each other
const JITTER = 7
const FASTEST = 'bg-purple-500 dark:bg-purple-300'

const seconds = (ms) => (ms / 1000).toFixed(3)

/**
 * A line per driver, in their order: each clean lap as a dot along a common scale, the median as a
 * bar, the best lap in gold (the session's `fastest` in purple), then the figures: best, median, the
 * spread of the clean laps, the incidents and the time they cost. The lowest of each column is in gold.
 */
export default function LapSpread({ drivers, fastest }) {
  const { t } = useTranslation('race')
  const [over, setOver] = useState(null)
  const clean = drivers.flatMap((driver) => driver.times.filter((time) => time <= driver.limit))
  const lo = Math.floor(Math.min(...clean) / STEP) * STEP
  const hi = Math.max(lo + STEP, Math.ceil(Math.max(...clean) / STEP) * STEP)
  const share = (time) => ((time - lo) / (hi - lo)) * 100
  const marks = []
  for (let time = lo; time <= hi; time += hi - lo > WIDE ? 2 * STEP : STEP) marks.push(time)
  const lowest = (key) => drivers.length > 1 && Math.min(...drivers.map((driver) => driver[key]))
  const figure = (driver, key, text) => (
    <span
      data-testid={`analysis-${key}`}
      className={`text-right tabular-nums ${driver[key] === lowest(key) ? `font-bold ${GOLD}` : ''}`}
    >
      {text}
    </span>
  )

  return (
    <div
      className={`${GRID_LIST} grid-cols-[auto_auto_minmax(12rem,1fr)_repeat(5,auto)]`}
      onMouseLeave={() => setOver(null)}
    >
      <div className={GRID_HEAD}>
        <span />
        <span>{t('glossary:driver', { count: 1 })}</span>
        <span className="flex gap-3.5 font-medium tracking-normal text-muted-foreground normal-case">
          <span className="inline-flex items-center gap-1.5">
            <i className="size-1.5 rounded-full bg-muted-foreground/60" />
            {t('analysis.key.clean')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="h-3 w-0.5 rounded-full bg-foreground" />
            {t('analysis.key.median')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="size-2 rounded-full bg-yellow-500" />
            {t('analysis.key.best')}
          </span>
        </span>
        <span className="text-right">{t('leaderboard.best')}</span>
        <span className="text-right">{t('analysis.columns.median')}</span>
        <span className="text-right">{t('analysis.columns.spread')}</span>
        <span className="text-right">{t('analysis.columns.incidents')}</span>
        <span className="text-right">{t('analysis.columns.lost')}</span>
      </div>
      {drivers.map((driver, i) => (
        <div key={driver.key} className={GRID_ROW} data-testid="analysis-row">
          <span className="text-right text-muted-foreground tabular-nums">{i + 1}</span>
          <span className="flex items-center gap-2 font-bold">
            <DriverAvatar driver={driver.face} className="size-6" />
            {driver.code}
          </span>
          <div className="relative mx-1.5 h-full">
            {marks.map((time) => (
              <i key={time} className="absolute inset-y-0 w-px bg-border" style={{ left: `${share(time)}%` }} />
            ))}
            {driver.times.map((time, lap) => {
              if (time > driver.limit || time === driver.best) return null
              const on = over?.key === driver.key && over.lap === lap
              return (
                <span
                  key={lap}
                  data-testid="analysis-lap"
                  onMouseEnter={() => setOver({ key: driver.key, lap })}
                  className="absolute grid size-3 -translate-1/2 place-items-center"
                  style={{
                    left: `${share(time)}%`,
                    top: `calc(50% + ${((lap * 7919) % (2 * JITTER + 1)) - JITTER}px)`,
                  }}
                >
                  <i
                    className={`rounded-full ${on ? 'size-2.5' : 'size-1.5 opacity-50'}`}
                    style={{ backgroundColor: driver.ink }}
                  />
                </span>
              )
            })}
            <i
              className="absolute inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
              style={{ left: `${share(driver.median)}%` }}
            />
            <i
              className={`absolute top-1/2 size-2.5 -translate-1/2 rounded-full ring-2 ring-card ${driver.best === fastest ? FASTEST : 'bg-yellow-500'}`}
              style={{ left: `${share(driver.best)}%` }}
            />
            {over?.key === driver.key && (
              <div
                data-testid="analysis-tip"
                className={`pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 rounded-md border border-border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md ${share(driver.times[over.lap]) > 60 ? '-translate-x-full -ml-3' : 'ml-3'}`}
                style={{ left: `${share(driver.times[over.lap])}%` }}
              >
                <span className="text-muted-foreground">
                  {t('analysis.driverLap', { driver: driver.code, lap: over.lap + 1 })}
                </span>{' '}
                <span className="font-mono font-semibold tabular-nums">{seconds(driver.times[over.lap])}</span>
              </div>
            )}
          </div>
          {figure(driver, 'best', seconds(driver.best))}
          {figure(driver, 'median', seconds(driver.median))}
          {figure(driver, 'spread', `±${(driver.spread / 1000).toFixed(2)}`)}
          {figure(driver, 'incidents', driver.incidents)}
          {figure(driver, 'lost', t('analysis.seconds', { value: (driver.lost / 1000).toFixed(1) }))}
        </div>
      ))}
      <div className="col-span-full grid h-6 grid-cols-subgrid px-4">
        <span />
        <span />
        <div className="relative mx-1.5 text-[11px] text-muted-foreground tabular-nums">
          {marks.map((time) => (
            <span key={time} className="absolute top-1 -translate-x-1/2" style={{ left: `${share(time)}%` }}>
              {(time / 1000).toFixed(time % 1000 ? 1 : 0)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DriverAvatar from '@/components/driver/DriverAvatar'
import { gapsTo } from './lapStats'

const HEIGHT = 300
// Before the box is measured, and where it never is (tests)
const FALLBACK_WIDTH = 800
// The height of a driver's row of incidents, above the pace
const RAIL = 10
// How close to a line the pointer picks its driver
const REACH = 16
// Two labels at the end of the gaps keep this far apart
const LABEL_GAP = 20
const DIMMED = 0.16
const TEXT = 'fill-muted-foreground'
const FASTEST = 'fill-purple-600 dark:fill-purple-300'

const seconds = (ms) => (ms / 1000).toFixed(3)
const signed = (value, digits) => `${value < 0 ? '−' : '+'}${Math.abs(value).toFixed(digits)}`
const stepOf = (range) => [0.5, 1, 2, 5, 10, 20, 50, 100].find((step) => range / step <= 6) ?? 200
function ticksOf(lo, hi, step) {
  const ticks = []
  for (let value = Math.ceil(lo / step) * step; value <= hi + 1e-6; value += step) ticks.push(value)
  return ticks
}
const lapTicksOf = (laps) => [1, ...ticksOf(laps > 30 ? 10 : 5, laps, laps > 30 ? 10 : 5)]

/** A ref for a box and its width, followed as it changes. */
function useWidth() {
  const box = useRef(null)
  const [width, setWidth] = useState(FALLBACK_WIDTH)
  useLayoutEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => el.clientWidth && setWidth(el.clientWidth)
    measure()
    const resized = new ResizeObserver(measure)
    resized.observe(el)
    return () => resized.disconnect()
  }, [])
  return [box, width]
}

/**
 * A line per driver along the laps. `pace`: the pace over the clean laps (the slower, the higher), the
 * incidents as a row of dots per driver above, the bigger the longer the lap, and the session's
 * `fastest` lap. `gaps`: how far each one is behind `leader` (on top), each line ending on its driver.
 * The pointer reads a lap (the real times, not the pace) and brings out the nearest driver, as `focus` does.
 */
export default function LapLines({ view, drivers, leader, fastest, focus, onFocus }) {
  const { t } = useTranslation('race')
  const [box, width] = useWidth()
  const [lap, setLap] = useState(null)
  const pace = view === 'pace'
  const series = drivers.map((driver) => ({
    driver,
    values: (pace ? driver.pace : gapsTo(leader, driver)).map((value) => (value === null ? null : value / 1000)),
  }))
  const laps = Math.max(...series.map(({ values }) => values.length))
  const m = { l: 46, r: pace ? 14 : 108, t: pace ? 30 + series.length * RAIL : 12, b: 26 }

  // The scale of the pace holds every clean lap, and only them
  const all = pace
    ? drivers.flatMap((driver) => driver.times.filter((time) => time <= driver.limit).map((time) => time / 1000))
    : [0, ...series.flatMap(({ values }) => values)]
  const step = stepOf(Math.max(...all) - Math.min(...all))
  const lo = Math.floor(Math.min(...all) / step) * step
  const hi = Math.max(lo + step, Math.ceil(Math.max(...all) / step) * step)
  const x = (at) => m.l + ((at - 1) / Math.max(1, laps - 1)) * (width - m.l - m.r)
  const across = (value) => ((value - lo) / (hi - lo)) * (HEIGHT - m.t - m.b)
  // Pace: the slower, the higher. Gaps: the leader on top, the others below
  const y = (value) => (pace ? HEIGHT - m.b - across(value) : m.t + across(value))
  const dim = (driver) => (focus !== null && focus !== driver.key ? DIMMED : 1)
  const isClean = (driver, at) => driver.times[at] <= driver.limit

  function move(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const [px, py] = [event.clientX - rect.left, event.clientY - rect.top]
    const at = Math.min(laps, Math.max(1, Math.round(1 + ((px - m.l) / (width - m.l - m.r)) * (laps - 1))))
    let near = null
    let reach = REACH
    for (const { driver, values } of series) {
      const value = values[at - 1]
      if (value == null || Math.abs(y(value) - py) >= reach) continue
      reach = Math.abs(y(value) - py)
      near = driver.key
    }
    if (at !== lap) setLap(at)
    if (near !== focus) onFocus(near)
  }
  function leave() {
    setLap(null)
    onFocus(null)
  }

  // A clean lap as it was driven; an incident is in the rows above
  const lapDot = (driver, at, r) =>
    isClean(driver, at) && (
      <circle
        key={at}
        cx={x(at + 1)}
        cy={y(driver.times[at] / 1000)}
        r={r}
        fill={driver.ink}
        className="stroke-card"
        strokeWidth={r > 3 ? 2 : 0}
      />
    )

  // The gaps end on their driver, in the margin
  const ends = pace
    ? []
    : series
        .map(({ driver, values }) => ({ driver, lap: values.length, value: values.at(-1), at: y(values.at(-1)) }))
        .sort((a, b) => a.at - b.at)
  ends.forEach((end, i) => i && (end.at = Math.max(end.at, ends[i - 1].at + LABEL_GAP)))
  const lapsDown = (driver) => leader.times.length - driver.times.length

  const holder = pace && drivers.find((driver) => driver.best === fastest)
  const fastestLap = holder ? holder.times.indexOf(fastest) + 1 : null
  const read =
    lap === null
      ? []
      : series
          .filter(({ driver, values }) => (pace ? driver.times.length >= lap : values[lap - 1] != null))
          .map(({ driver, values }) => ({ driver, value: values[lap - 1], time: driver.times[lap - 1] }))
          .sort((a, b) => (pace ? a.time - b.time : a.value - b.value))

  return (
    <div
      ref={box}
      className="relative"
      style={{ height: HEIGHT }}
      onMouseMove={move}
      onMouseLeave={leave}
      data-testid="analysis-plot"
    >
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={t(`analysis.views.${view}`)}
        className="block text-[11px] tabular-nums"
      >
        {ticksOf(lo, hi, step).map((value) => (
          <g key={value}>
            <line
              x1={m.l}
              x2={width - m.r}
              y1={y(value)}
              y2={y(value)}
              className={!pace && value === 0 ? 'stroke-foreground/25' : 'stroke-border'}
            />
            <text x={m.l - 8} y={y(value) + 4} textAnchor="end" className={TEXT}>
              {pace ? value.toFixed(step < 1 ? 1 : 0) : value ? signed(value, 0) : 0}
            </text>
          </g>
        ))}
        {lapTicksOf(laps).map((at) => (
          <text key={at} x={x(at)} y={HEIGHT - 8} textAnchor="middle" className={TEXT}>
            {at}
          </text>
        ))}
        <text x={m.l - 8} y={HEIGHT - 8} textAnchor="end" className={TEXT}>
          {t('glossary:lap', { count: 1 })}
        </text>

        {pace && (
          <text x={m.l} y={12} className={TEXT}>
            {t('analysis.incidents')}
          </text>
        )}
        {pace &&
          series.map(({ driver }, row) =>
            driver.times.map((time, at) => {
              if (isClean(driver, at)) return null
              const r = Math.min(4.5, 1.6 + Math.sqrt((time - driver.median) / 1000) * 0.9)
              const on = at + 1 === lap
              return (
                <circle
                  key={`${driver.key}-${at}`}
                  data-testid="analysis-incident"
                  cx={x(at + 1)}
                  cy={24 + row * RAIL}
                  r={on ? r + 1 : r}
                  fill={driver.ink}
                  opacity={dim(driver) * (on ? 1 : 0.8)}
                />
              )
            })
          )}

        {ends.map(({ driver, lap: last, value, at }) => (
          <path
            key={driver.key}
            d={`M${x(last)} ${y(value)}L${width - m.r + 6} ${at}`}
            fill="none"
            stroke={driver.ink}
            opacity={0.35 * dim(driver)}
          />
        ))}
        {/* The driver in focus is drawn last, over the others */}
        {[...series]
          .sort((a, b) => (a.driver.key === focus) - (b.driver.key === focus))
          .map(({ driver, values }) => {
            const points = values.flatMap((value, at) => (value === null ? [] : [[x(at + 1), y(value)]]))
            return (
              <g key={driver.key} opacity={dim(driver)} data-testid="analysis-line" data-driver={driver.code}>
                {points.length === 1 ? (
                  <circle cx={points[0][0]} cy={points[0][1]} r={2.5} fill={driver.ink} />
                ) : (
                  <path
                    d={points.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join('')}
                    fill="none"
                    stroke={driver.ink}
                    strokeWidth={driver.key === focus ? 2.5 : 1.75}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                {pace && driver.key === focus && (
                  <g opacity={0.75}>{driver.times.map((_, at) => lapDot(driver, at, 2.5))}</g>
                )}
              </g>
            )
          })}

        {/* The session's fastest lap, as in the leaderboard */}
        {fastestLap && (
          <g className={FASTEST} data-testid="analysis-fastest">
            <circle cx={x(fastestLap)} cy={y(fastest / 1000)} r={4.5} className="stroke-card" strokeWidth={2} />
            <text
              x={x(fastestLap) + (x(fastestLap) > width - 80 ? -9 : 9)}
              y={y(fastest / 1000) + 4}
              textAnchor={x(fastestLap) > width - 80 ? 'end' : 'start'}
              className="font-bold"
            >
              {seconds(fastest)}
            </text>
          </g>
        )}

        {lap !== null && (
          <g>
            <line x1={x(lap)} x2={x(lap)} y1={m.t} y2={HEIGHT - m.b} className="stroke-muted-foreground/60" />
            {read.map(({ driver, value }) => (
              <g key={driver.key} opacity={dim(driver)}>
                {pace ? (
                  lapDot(driver, lap - 1, 4)
                ) : (
                  <circle cx={x(lap)} cy={y(value)} r={4} fill={driver.ink} className="stroke-card" strokeWidth={2} />
                )}
              </g>
            ))}
          </g>
        )}
      </svg>

      {ends.map(({ driver, value, at }) => (
        <div
          key={driver.key}
          data-testid="analysis-end"
          className="pointer-events-none absolute flex -translate-y-1/2 items-center gap-1.5 text-xs font-bold whitespace-nowrap"
          style={{ left: width - m.r + 10, top: at, opacity: dim(driver) }}
        >
          <DriverAvatar driver={driver.face} className="size-4" />
          {driver.code}
          {driver !== leader && (
            <span className="font-normal text-muted-foreground tabular-nums">
              {lapsDown(driver) > 0 ? t('gapDisplay.lapsGap', { count: lapsDown(driver) }) : signed(value, 1)}
            </span>
          )}
        </div>
      ))}

      {lap !== null && (
        <div
          data-testid="analysis-tip"
          className="pointer-events-none absolute z-10 rounded-lg border border-border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-md"
          // Beside the lap read, on the side that has room
          style={
            x(lap) > width / 2 ? { right: width - x(lap) + 12, top: m.t + 6 } : { left: x(lap) + 18, top: m.t + 6 }
          }
        >
          <p className="mb-1 font-semibold text-muted-foreground">{t('analysis.lap', { lap })}</p>
          <div className="grid grid-cols-[auto_auto_auto_auto] items-center gap-x-2 gap-y-1">
            {read.map(({ driver, value, time }) => (
              <div
                key={driver.key}
                data-testid="analysis-read"
                className={`col-span-full grid grid-cols-subgrid items-center ${dim(driver) < 1 ? 'opacity-45' : ''}`}
              >
                <DriverAvatar driver={driver.face} className="size-4" />
                <span className="font-bold">{driver.code}</span>
                <span className="text-muted-foreground">
                  {pace && !isClean(driver, lap - 1) && t('analysis.incident')}
                </span>
                <span className="text-right font-mono font-semibold tabular-nums">
                  {pace ? seconds(time) : driver === leader ? t('gapDisplay.leader') : signed(value, 3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

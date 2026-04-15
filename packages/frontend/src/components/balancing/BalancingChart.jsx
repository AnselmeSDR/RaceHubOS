import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import LapTime from '../race/LapTime'

function computeMedian(values) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function fixColor(c) {
  if (!c) return '#3B82F6'
  const lower = c?.toLowerCase?.() || ''
  if (['#fff', '#ffffff', 'white'].includes(lower)) return '#94A3B8'
  return c
}

function computeTrend(laps) {
  if (laps.length < 10) return null
  const half = Math.floor(laps.length / 2)
  const firstHalf = computeMedian(laps.slice(0, half))
  const secondHalf = computeMedian(laps.slice(half))
  if (!firstHalf || !secondHalf) return null
  const delta = secondHalf - firstHalf
  // Threshold: 50ms difference to be considered a trend
  if (Math.abs(delta) < 50) return { direction: 'stable', delta }
  return { direction: delta > 0 ? 'slower' : 'faster', delta }
}

export default function BalancingChart({ entries = [], maxLapTime = null }) {
  const { chartData, cars, medians } = useMemo(() => {
    const cars = []
    const carLapsMap = {}

    for (const entry of entries) {
      if (!entry.car || !entry.laps?.length) continue
      const name = [entry.car.brand, entry.car.model].filter(Boolean).join(' ') || `Voiture ${entry.controller + 1}`
      const color = fixColor(entry.car.color)

      const key = `${name}-${entry.controller}`
      cars.push({ key, name, color })
      // Exclude first lap (pit exit) and laps exceeding maxLapTime
      let laps = entry.laps.slice(1)
      if (maxLapTime) laps = laps.filter(l => l.lapTime <= maxLapTime)
      carLapsMap[key] = laps
    }

    // Build chart data: one row per lap number
    const maxLap = Math.max(0, ...Object.values(carLapsMap).flatMap(l => l.map(x => x.lapNumber)))
    const chartData = []
    for (let i = 2; i <= maxLap; i++) {
      const row = { lap: i }
      for (const [key, laps] of Object.entries(carLapsMap)) {
        const found = laps.find(l => l.lapNumber === i)
        if (found) row[key] = found.lapTime / 1000
      }
      chartData.push(row)
    }

    // Calculate medians (excluding first lap)
    const medians = {}
    for (const [key, laps] of Object.entries(carLapsMap)) {
      const times = laps.map(l => l.lapTime / 1000)
      medians[key] = computeMedian(times)
    }

    return { chartData, cars, medians }
  }, [entries, maxLapTime])

  // Stats per car for the summary below the chart
  const carStats = useMemo(() => {
    const stats = entries
      .filter(e => e.car && e.laps?.length > 1)
      .map(entry => {
        const name = [entry.car.brand, entry.car.model].filter(Boolean).join(' ') || `Voiture ${entry.controller + 1}`
        const key = `${name}-${entry.controller}`
        // Exclude first lap and outliers from calculations
        let filteredLaps = entry.laps.slice(1)
        if (maxLapTime) filteredLaps = filteredLaps.filter(l => l.lapTime <= maxLapTime)
        const times = filteredLaps.map(l => l.lapTime)
        if (times.length === 0) return null
        const best = Math.min(...times)

        // Median of all laps
        const sorted = [...times].sort((a, b) => a - b)
        const median = computeMedian(times)

        // Average of best 60% laps
        const count60 = Math.ceil(sorted.length * 0.6)
        const avg60 = count60 >= 3 ? sorted.slice(0, count60).reduce((s, t) => s + t, 0) / count60 : null

        // Compute median per window of 5 laps (for detail section)
        const medianWindows = []
        for (let i = 0; i + 5 <= sorted.length; i += 5) {
          const slice = sorted.slice(i, i + 5)
          medianWindows.push({ from: i + 1, to: i + 5, value: slice[2] })
        }
        const bestMedianWindow = medianWindows.length > 0 ? Math.min(...medianWindows.map(m => m.value)) : null

        // Compute trend
        const trend = computeTrend(times)

        return {
          key,
          name,
          color: fixColor(entry.car.color),
          car: entry.car,
          best,
          median,
          avg60,
          medianWindows,
          bestMedianWindow,
          trend,
          totalLaps: times.length,
        }
      })
      .filter(Boolean)

    // Compute delta to fastest best median window
    const fastestBestMed = stats.reduce((min, s) => s.bestMedianWindow && (!min || s.bestMedianWindow < min) ? s.bestMedianWindow : min, null)
    return stats
      .map(s => ({
        ...s,
        deltaToFastest: s.bestMedianWindow && fastestBestMed ? s.bestMedianWindow - fastestBestMed : null,
      }))
      .sort((a, b) => (a.bestMedianWindow ?? Infinity) - (b.bestMedianWindow ?? Infinity))
  }, [entries, maxLapTime])

  if (cars.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Aucune donnée de tour disponible
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Évolution des temps au tour</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 25, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="lap"
                label={{ value: 'Tour(s)', position: 'insideBottomRight', offset: -5 }}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                domain={['auto', 'auto']}
                label={{ value: 'Temps (s)', angle: -90, position: 'insideLeft', offset: 5 }}
                tick={{ fontSize: 12 }}
                tickFormatter={v => v.toFixed(1)}
              />
              <Tooltip
                formatter={(value, name) => {
                  const car = cars.find(c => c.key === name)
                  return [`${value.toFixed(3)}s`, car?.name || name]
                }}
                labelFormatter={label => `Tour ${label}`}
              />
              <Legend formatter={(value) => {
                const car = cars.find(c => c.key === value)
                return car?.name || value
              }} />
              {cars.map(({ key, color }) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: color }}
                  activeDot={{ r: 5 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
              {cars.map(({ key, color }) => {
                const median = medians[key]
                if (!median) return null
                return (
                  <ReferenceLine
                    key={`median-${key}`}
                    y={median}
                    stroke={color}
                    strokeDasharray="5 5"
                    strokeOpacity={0.5}
                  />
                )
              })}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Stats summary per car */}
      {carStats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {carStats.map(({ key, name, color, car, best, median, avg60, medianWindows, bestMedianWindow, trend, totalLaps, deltaToFastest }) => (
            <Card key={key}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-semibold text-sm truncate">{name}</span>
                  <div className="flex items-center gap-2 ml-auto">
                    {trend && (
                      <span className={`flex items-center gap-0.5 text-xs ${
                        trend.direction === 'faster' ? 'text-green-500' :
                        trend.direction === 'slower' ? 'text-red-500' : 'text-muted-foreground'
                      }`}>
                        {trend.direction === 'faster' && <TrendingDown className="size-3" />}
                        {trend.direction === 'slower' && <TrendingUp className="size-3" />}
                        {trend.direction === 'stable' && <Minus className="size-3" />}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{totalLaps} tours</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-2 text-center">
                  <div>
                    <div className="text-xs text-muted-foreground/60 uppercase">Meilleur</div>
                    <LapTime time={best} size="md" className="text-fastest-lap" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground/60 uppercase">Best méd. 5</div>
                    <LapTime time={bestMedianWindow} size="md" highlight />
                    {deltaToFastest > 0 && (
                      <div className="text-xs font-mono text-red-400 mt-0.5">
                        +{(deltaToFastest / 1000).toFixed(3)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground/60 uppercase">Moy. 60%</div>
                    <LapTime time={avg60} size="md" />
                  </div>
                </div>
                {medianWindows.length > 0 && (
                  <div className="border-t border-border pt-2">
                    <div className="text-xs text-muted-foreground/60 uppercase mb-1.5">Médiane / 5 tours</div>
                    <div className="flex gap-4">
                      {[0, 1].map(col => {
                        const half = Math.ceil(medianWindows.length / 2)
                        const items = col === 0 ? medianWindows.slice(0, half) : medianWindows.slice(half)
                        return (
                          <div key={col} className="flex-1 space-y-1.5">
                            {items.map(({ from, to, value }) => (
                              <div key={from} className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">{from}-{to}</span>
                                <LapTime time={value} size="sm" />
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
